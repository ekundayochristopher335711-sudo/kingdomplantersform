import type { SupabaseClient } from '@supabase/supabase-js';

export interface RegistrationRecord {
  id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  gender: string | null;
  church_or_fellowship: string | null;
  additional_guests: number;
  total_attendees: number;
  created_at: string;
}

export interface AttendanceOverview {
  total_registrations: number;
  total_additional_guests: number;
  total_expected_attendance: number;
  registrations_today: number;
  trend: { day: string; registrations: number; expected_attendance: number }[];
}

export interface RegistrationFilters {
  search: string;
  from: string;
  to: string;
}

export const attendancePageSize = 12;

export function organizerToday(timeZone: string) {
  const currentDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = currentDateFormatter.formatToParts();
  const value = (part: Intl.DateTimeFormatPartTypes) =>
    parts.find(({ type }) => type === part)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addCalendarDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatRegistrationDate(timestamp: string, timeZone: string, includeTime = false) {
  const formatter = new Intl.DateTimeFormat('en-NG', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric' as const, minute: '2-digit' as const } : {}),
  });
  return formatter.format(new Date(timestamp));
}

function zonedMidnight(day: string, timeZone: string) {
  const midnight = `${day}T00:00:00`;
  const offsetFormatter = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' });
  const getOffset = (timestamp: string) => offsetFormatter.formatToParts(new Date(timestamp))
    .find(({ type }) => type === 'timeZoneName')?.value.slice(3) || '+00:00';
  const approximateOffset = getOffset(`${midnight}Z`);
  return `${midnight}${getOffset(`${midnight}${approximateOffset}`)}`;
}

const registrationColumns = 'id, full_name, phone_number, email, gender, church_or_fellowship, additional_guests, total_attendees, created_at';

export async function fetchRegistrations(
  client: SupabaseClient,
  filters: RegistrationFilters,
  {
    offset,
    limit,
    signal,
    snapshot,
  }: { offset: number; limit: number; signal?: AbortSignal; snapshot?: string },
  timeZone: string,
) {
  let query = client.from('registrations')
    .select(registrationColumns, { count: snapshot ? undefined : 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.search) {
    // PostgreSQL's literal prefix keeps punctuation in names and email addresses searchable.
    query = query.filter('search_text', 'imatch', `***=${filters.search}`);
  }
  if (filters.from) query = query.gte('created_at', zonedMidnight(filters.from, timeZone));
  if (filters.to) query = query.lt('created_at', zonedMidnight(addCalendarDays(filters.to, 1), timeZone));
  if (snapshot) query = query.lte('created_at', snapshot);
  if (signal) query = query.abortSignal(signal);

  const { data, count, error } = await query.overrideTypes<RegistrationRecord[], { merge: false }>();
  if (error) throw error;
  return { records: data ?? [], count: count ?? 0 };
}

export async function fetchOverview(client: SupabaseClient, signal: AbortSignal) {
  const { data, error } = await client.rpc('registration_overview')
    .abortSignal(signal);
  if (error) throw error;
  const overview = data as AttendanceOverview | null;
  if (!overview || !Array.isArray(overview.trend)) {
    throw new Error('Attendance overview is unavailable.');
  }
  return overview;
}

const csvHeaders = [
  'Full name', 'Phone number', 'Email address', 'Gender', 'Church/Fellowship',
  'Additional guests', 'Total people', 'Registration date (UTC)',
];

function csvField(value: string | number | null) {
  const text = String(value ?? '');
  // Keep spreadsheet applications from interpreting visitor-supplied values as formulas.
  const safeText = /^[\s\u0000-\u001F]*[=+\-@\t\r\n\uFF1D\uFF0B\uFF0D\uFF20]/u.test(text)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export async function exportAttendance(
  client: SupabaseClient,
  filters: RegistrationFilters,
  signal: AbortSignal,
  timeZone: string,
) {
  const snapshot = new Date().toISOString();
  const chunkSize = 500;
  const rows = [csvHeaders.map(csvField).join(',')];
  let offset = 0;

  while (!signal.aborted) {
    const { records } = await fetchRegistrations(client, filters, {
      offset, limit: chunkSize, signal, snapshot,
    }, timeZone);
    for (const record of records) {
      rows.push([
        record.full_name, record.phone_number, record.email, record.gender, record.church_or_fellowship,
        record.additional_guests, record.total_attendees, record.created_at,
      ].map(csvField).join(','));
    }
    if (records.length < chunkSize) break;
    offset += records.length;
  }

  if (signal.aborted) return;
  const { data: authorized, error } = await client.rpc('is_event_organizer').abortSignal(signal);
  if (signal.aborted) return;
  if (error) throw error;
  if (authorized !== true) throw new Error('This account does not have organizer access.');
  if (rows.length === 1) throw new Error('There are no registrations to export.');

  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${organizerToday(timeZone)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
