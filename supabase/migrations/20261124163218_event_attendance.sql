create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Keep organizer membership and idempotency keys outside the Data API.
create schema event_private;
revoke all on schema event_private from public, anon, authenticated;
grant usage on schema event_private to anon, authenticated;

create table event_private.event_organizers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone_number text not null check (char_length(phone_number) between 7 and 32),
  email text check (char_length(email) <= 254),
  gender text check (char_length(gender) <= 50),
  church_or_fellowship text check (char_length(church_or_fellowship) <= 120),
  additional_guests integer not null default 0 check (additional_guests between 0 and 1000),
  total_attendees integer generated always as (1 + additional_guests) stored,
  created_at timestamptz not null default clock_timestamp(),
  search_text text generated always as (
    full_name || ' ' || phone_number || ' ' || regexp_replace(phone_number, '[^0-9]', '', 'g')
    || ' ' || coalesce(email, '') || ' ' || coalesce(church_or_fellowship, '')
  ) stored
);

create table event_private.registration_requests (
  request_id uuid primary key,
  registration_id uuid not null unique references public.registrations (id) on delete cascade
);

revoke all on table event_private.event_organizers from public, anon, authenticated;
revoke all on table event_private.registration_requests from public, anon, authenticated;
revoke all on table public.registrations from public, anon, authenticated;
grant select on table public.registrations to authenticated;

alter table event_private.event_organizers enable row level security;
alter table event_private.registration_requests enable row level security;
alter table public.registrations enable row level security;

create index registrations_recent_idx on public.registrations (created_at desc, id desc);
create index registrations_search_idx on public.registrations using gin (search_text extensions.gin_trgm_ops);

create function event_private.is_event_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from event_private.event_organizers
    where user_id = (select auth.uid())
  );
$$;

revoke all on function event_private.is_event_organizer() from public, anon, authenticated;
grant execute on function event_private.is_event_organizer() to authenticated;

create policy "Organizers can read registrations"
on public.registrations
for select to authenticated
using ((select event_private.is_event_organizer()));

create function public.is_event_organizer()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select event_private.is_event_organizer();
$$;

revoke all on function public.is_event_organizer() from public, anon, authenticated;
grant execute on function public.is_event_organizer() to authenticated;

-- This narrowly scoped writer is the only entry point for anonymous visitors.
create function event_private.submit_registration(
  p_request_id uuid,
  p_full_name text,
  p_phone_number text,
  p_email text,
  p_gender text,
  p_church_or_fellowship text,
  p_additional_guests integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := regexp_replace(p_full_name, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_phone text := regexp_replace(p_phone_number, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_email text := nullif(regexp_replace(p_email, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_gender text := nullif(regexp_replace(p_gender, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_fellowship text := nullif(regexp_replace(p_church_or_fellowship, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  v_registration public.registrations%rowtype;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'A registration request ID is required.';
  end if;
  if v_full_name is null or char_length(v_full_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Enter a full name between 2 and 120 characters.';
  end if;
  if v_phone is null or char_length(v_phone) > 32 or v_phone !~ '^\+?[0-9(). -]+$'
    or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception using errcode = '22023', message = 'Enter a valid phone number with 7 to 15 digits.';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception using errcode = '22023', message = 'Enter a valid email address.';
  end if;
  if char_length(v_gender) > 50 or char_length(v_fellowship) > 120 then
    raise exception using errcode = '22023', message = 'Shorten the gender or church/fellowship entry.';
  end if;
  if p_additional_guests is null or p_additional_guests not between 0 and 1000 then
    raise exception using errcode = '22023', message = 'Enter a whole number of additional guests from 0 to 1000.';
  end if;

  -- Serialize retries sharing the same token so concurrent requests write one row.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select registrations.* into v_registration
  from event_private.registration_requests as requests
  join public.registrations on registrations.id = requests.registration_id
  where requests.request_id = p_request_id;

  if found then
    if row(v_full_name, v_phone, v_email, v_gender, v_fellowship, p_additional_guests)
      is distinct from row(
        v_registration.full_name, v_registration.phone_number, v_registration.email,
        v_registration.gender, v_registration.church_or_fellowship, v_registration.additional_guests
      ) then
      raise exception using errcode = 'P0001', message = 'This request ID has already been used for a different registration.';
    end if;
  else
    insert into public.registrations (
      full_name, phone_number, email, gender, church_or_fellowship, additional_guests
    )
    values (v_full_name, v_phone, v_email, v_gender, v_fellowship, p_additional_guests)
    returning * into v_registration;

    insert into event_private.registration_requests (request_id, registration_id)
    values (p_request_id, v_registration.id);
  end if;

  return jsonb_build_object(
    'id', v_registration.id,
    'full_name', v_registration.full_name,
    'total_attendees', v_registration.total_attendees
  );
end;
$$;

revoke all on function event_private.submit_registration(uuid, text, text, text, text, text, integer)
from public, anon, authenticated;
grant execute on function event_private.submit_registration(uuid, text, text, text, text, text, integer)
to anon, authenticated;

create function public.submit_registration(
  p_request_id uuid,
  p_full_name text,
  p_phone_number text,
  p_email text,
  p_gender text,
  p_church_or_fellowship text,
  p_additional_guests integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select event_private.submit_registration(
    p_request_id, p_full_name, p_phone_number, p_email, p_gender, p_church_or_fellowship, p_additional_guests
  );
$$;

revoke all on function public.submit_registration(uuid, text, text, text, text, text, integer)
from public, anon, authenticated;
grant execute on function public.submit_registration(uuid, text, text, text, text, text, integer)
to anon, authenticated;

create function public.registration_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (current_timestamp at time zone 'Africa/Lagos')::date;
  v_start_today timestamptz := v_today::timestamp at time zone 'Africa/Lagos';
  v_start_tomorrow timestamptz := (v_today + 1)::timestamp at time zone 'Africa/Lagos';
  v_start_trend timestamptz := (v_today - 29)::timestamp at time zone 'Africa/Lagos';
begin
  if not event_private.is_event_organizer() then
    raise exception using errcode = '42501', message = 'Organizer access is required.';
  end if;

  return (
    with counts as (
      select
        count(*) as total_registrations,
        coalesce(sum(additional_guests), 0) as total_additional_guests,
        coalesce(sum(total_attendees), 0) as total_expected_attendance,
        count(*) filter (where created_at >= v_start_today and created_at < v_start_tomorrow) as registrations_today
      from public.registrations
    ),
    daily_trend as (
      select
        (created_at at time zone 'Africa/Lagos')::date as day,
        count(*) as registrations,
        sum(total_attendees) as expected_attendance
      from public.registrations
      where created_at >= v_start_trend and created_at < v_start_tomorrow
      group by 1
    )
    select to_jsonb(counts) || jsonb_build_object(
      'trend', coalesce((select jsonb_agg(to_jsonb(daily_trend) order by day) from daily_trend), '[]'::jsonb)
    )
    from counts
  );
end;
$$;

revoke all on function public.registration_overview() from public, anon, authenticated;
grant execute on function public.registration_overview() to authenticated;

alter publication supabase_realtime add table public.registrations;
