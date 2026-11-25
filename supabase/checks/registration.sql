\set ON_ERROR_STOP on

-- Run against a disposable database with the migration applied. Everything rolls back.
begin;

insert into auth.users (id, email)
values ('89f3c30c-ac9b-40ed-8688-72118164b451', 'organizer-check@example.test');

insert into event_private.event_organizers (user_id)
values ('89f3c30c-ac9b-40ed-8688-72118164b451');

set local role authenticated;
select set_config('request.jwt.claim.sub', '89f3c30c-ac9b-40ed-8688-72118164b451', true);
select set_config('event_test.before', public.registration_overview()::text, true);
reset role;

set local role anon;
do $$
declare
  first_request uuid := gen_random_uuid();
  first_response jsonb;
  retry_response jsonb;
begin
  first_response := public.submit_registration(
    first_request, ' Test Attendee One ', '08000000001', null, null, null, 0
  );
  assert first_response ->> 'full_name' = 'Test Attendee One', 'Full name was not normalized';
  assert (first_response ->> 'total_attendees')::integer = 1, 'Incorrect solo registration total';
  assert not (first_response ? 'phone_number'), 'Phone number leaked in the confirmation payload';

  retry_response := public.submit_registration(
    first_request, 'Test Attendee One', '08000000001', null, null, null, 0
  );
  assert first_response = retry_response, 'A retry did not reuse its original confirmation';

  begin
    perform public.submit_registration(
      first_request, 'Test Attendee One', '08000000001', null, null, null, 1
    );
    raise exception using errcode = 'XX000', message = 'A changed retry was accepted';
  exception when raise_exception then
    null;
  end;

  perform public.submit_registration(
    gen_random_uuid(), 'Test Attendee Two', '+234 800 000 0002', 'person@example.test', null, 'Test Fellowship', 3
  );
  perform public.submit_registration(
    gen_random_uuid(), 'Test Attendee Three', '08000000003', null, null, null, 2
  );

  begin
    perform public.submit_registration(
      gen_random_uuid(), 'Invalid Test', 'invalid', null, null, null, 0
    );
    raise exception 'An invalid phone number was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.submit_registration(
      gen_random_uuid(), 'Invalid Test', '08000000000', null, null, null, -1
    );
    raise exception 'A negative guest count was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform count(*) from public.registrations;
    raise exception 'Anonymous access to registration records was allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.registrations (full_name, phone_number, additional_guests)
    values ('Invalid Direct Write', '08000000000', 0);
    raise exception 'Anonymous direct registration writes were allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '4e213eb7-0b88-4bae-93f7-c67b72624b10', true);
do $$
begin
  assert not public.is_event_organizer(), 'An ordinary account gained organizer access';
  assert (select count(*) from public.registrations) = 0, 'RLS exposed private attendee records';
  begin
    perform public.registration_overview();
    raise exception 'An ordinary account gained access to aggregate data';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '89f3c30c-ac9b-40ed-8688-72118164b451', true);
do $$
declare
  totals_before jsonb := current_setting('event_test.before')::jsonb;
  totals_after jsonb := public.registration_overview();
  today_lagos text := ((current_timestamp at time zone 'Africa/Lagos')::date)::text;
  trend_before jsonb;
  trend_after jsonb;
begin
  assert public.is_event_organizer(), 'Organizer membership is not visible';
  assert (totals_after ->> 'total_registrations')::bigint
    - (totals_before ->> 'total_registrations')::bigint = 3, 'Expected 3 registrations';
  assert (totals_after ->> 'total_additional_guests')::bigint
    - (totals_before ->> 'total_additional_guests')::bigint = 5, 'Expected 5 additional guests';
  assert (totals_after ->> 'total_expected_attendance')::bigint
    - (totals_before ->> 'total_expected_attendance')::bigint = 8, 'Expected 8 attendees';
  assert (totals_after ->> 'registrations_today')::bigint
    - (totals_before ->> 'registrations_today')::bigint = 3, 'Expected 3 registrations today in Lagos';
  select point into trend_before from jsonb_array_elements(totals_before -> 'trend') as series(point)
    where point ->> 'day' = today_lagos;
  select point into trend_after from jsonb_array_elements(totals_after -> 'trend') as series(point)
    where point ->> 'day' = today_lagos;
  assert (trend_after ->> 'registrations')::bigint - coalesce((trend_before ->> 'registrations')::bigint, 0) = 3,
    'Todays trend bucket should contain the 3 new registrations';
  assert (trend_after ->> 'expected_attendance')::bigint
    - coalesce((trend_before ->> 'expected_attendance')::bigint, 0) = 8,
    'Todays trend bucket should include the 8 newly expected attendees';
  assert (select count(*) from public.registrations where search_text ilike '%test fellowship%') >= 1,
    'Organizer search could not find a matching fellowship';
end;
$$;
reset role;

delete from event_private.event_organizers
where user_id = '89f3c30c-ac9b-40ed-8688-72118164b451';

set local role authenticated;
do $$
begin
  assert not public.is_event_organizer(), 'Organizer access remained after revocation';
  assert (select count(*) from public.registrations) = 0, 'Attendee access remained after revocation';
end;
$$;
reset role;

select 'Registration database checks passed.' as result;
rollback;
