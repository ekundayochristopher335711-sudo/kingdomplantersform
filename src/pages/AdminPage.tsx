import {
  useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode,
} from 'react';
import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import {
  ArrowDownToLine, ChartNoAxesCombined, ChevronLeft, ChevronRight, Church, ExternalLink,
  Eye, EyeOff, LogOut, RefreshCw, Search, UserRound, UsersRound, X,
} from 'lucide-react';
import { useEventContent } from '../config/EventContentProvider';
import {
  addCalendarDays, attendancePageSize, exportAttendance, fetchOverview, fetchRegistrations,
  formatRegistrationDate, organizerToday,
  type AttendanceOverview, type RegistrationFilters, type RegistrationRecord,
} from '../lib/admin';
import { getSupabase } from '../lib/supabase';
import './admin.css';

type AccessState = 'checking' | 'allowed' | 'denied' | 'error';

const metrics = [
  { key: 'total_registrations', label: 'Total registrations' },
  { key: 'total_expected_attendance', label: 'Expected attendance' },
  { key: 'total_additional_guests', label: 'Additional guests' },
  { key: 'registrations_today', label: 'Registrations today' },
] as const;

const emptyFilters: RegistrationFilters = { search: '', from: '', to: '' };
const countFormatter = new Intl.NumberFormat('en-NG');
const chartDayFormatter = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
const pageHeader = 'Attendance dashboard';
let nextListenerId = 0;

export default function AdminPage() {
  const { config } = useEventContent();
  const client = getSupabase();

  useEffect(() => {
    const oldTitle = document.title;
    document.title = `${pageHeader} | ${config.title}`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.append(robots);
    return () => {
      document.title = oldTitle;
      robots.remove();
    };
  }, [config.title]);

  return client ? <AdminAccess client={client} timeZone={config.timezone} /> : <AdminLogin client={null} />;
}

function AdminAccess({ client, timeZone }: { client: SupabaseClient; timeZone: string }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [access, setAccess] = useState<{ userId: string; state: AccessState }>();
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;
  const currentAccess = access?.userId === userId ? access?.state : 'checking';
  const recheck = useCallback(() => {
    setAccess(undefined);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) setAccess(undefined);
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function checkAccess(currentUserId: string) {
      try {
        const { data, error } = await client.rpc('is_event_organizer').abortSignal(controller.signal);
        if (error) throw error;
        if (!controller.signal.aborted) {
          setAccess({ userId: currentUserId, state: data === true ? 'allowed' : 'denied' });
        }
      } catch {
        if (!controller.signal.aborted) setAccess({ userId: currentUserId, state: 'error' });
      }
    }
    void checkAccess(userId);
    return () => controller.abort();
  }, [attempt, client, userId]);

  if (session === undefined || (session && currentAccess === 'checking')) {
    return <AccessPanel title="Checking organizer access" description="Please wait while we verify your session." busy />;
  }
  if (!session) return <AdminLogin client={client} />;
  if (currentAccess === 'allowed') {
    return <Dashboard key={userId} client={client} onAccessChanged={recheck} timeZone={timeZone} />;
  }
  if (currentAccess === 'denied') {
    return (
      <AccessPanel
        title="Organizer access required"
        description="Ask the event team to authorize your account, or sign out and use an organizer account."
      >
        <SignOut client={client} />
      </AccessPanel>
    );
  }
  return (
    <AccessPanel title="Couldn’t verify access" description="Check your connection and try again.">
      <div className="organizer-access-actions">
        <button type="button" className="organizer-button organizer-button--solid" onClick={recheck}>Try again</button>
        <SignOut client={client} />
      </div>
    </AccessPanel>
  );
}

function AccessPanel({
  title, description, children, busy = false,
}: { title: string; description: string; children?: ReactNode; busy?: boolean }) {
  const { config } = useEventContent();
  return (
    <main className="organizer organizer-access">
      <div className="organizer-access-card" aria-busy={busy}>
        <a className="organizer-back" href="/"><ChevronLeft size={17} aria-hidden="true" /> Event website</a>
        <div className="organizer-access-brand">
          <BrandMark />
          <strong>{config.churchName}</strong>
        </div>
        <h1>{title}</h1>
        <p role={busy ? 'status' : undefined}>{description}</p>
        {children}
      </div>
    </main>
  );
}

function BrandMark() {
  const { config } = useEventContent();
  return (
    <span className="organizer-brand-mark">
      {config.logoUrl ? <img src={config.logoUrl} alt="" /> : <Church aria-hidden="true" />}
    </span>
  );
}

function AdminLogin({ client }: { client: SupabaseClient | null }) {
  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSignInError('');
    const values = new FormData(event.currentTarget);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(values.get('email')).trim(),
        password: String(values.get('password')),
      });
      if (error) {
        setSignInError(error.status === 429
          ? 'Too many attempts. Wait a few minutes and try again.'
          : error.code === 'email_provider_disabled' || (error.status && error.status >= 500)
            ? 'Sign-in is temporarily unavailable. Try again in a moment.'
            : 'Sign-in failed. Check your email and password and try again.');
      }
    } catch {
      setSignInError('Couldn’t connect to sign-in. Check your connection and try again.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AccessPanel
      title="Organizer sign-in"
      description={client ? 'Use your organizer account to view attendance and download registration records.' : 'The registration service is unavailable. Contact the site administrator to restore access.'}
    >
      <form className="organizer-login-form" onSubmit={signIn}>
        <label htmlFor="organizer-email">Email address</label>
        <input id="organizer-email" name="email" type="email" placeholder="Enter your email" autoComplete="username" disabled={!client} required />
        <label htmlFor="organizer-password">Password</label>
        <div className="organizer-password">
          <input id="organizer-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" disabled={!client} required />
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} disabled={!client} onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {signInError ? <p className="organizer-error" role="alert">{signInError}</p> : null}
        <button className="organizer-button organizer-button--solid" disabled={submitting || !client}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AccessPanel>
  );
}

function SignOut({ client }: { client: SupabaseClient }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  async function signOut() {
    setStatus('busy');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="organizer-sign-out">
      <button type="button" className="organizer-button" onClick={() => void signOut()} disabled={status === 'busy'}>
        <LogOut size={16} aria-hidden="true" /> {status === 'busy' ? 'Signing out…' : 'Sign out'}
      </button>
      {status === 'error' ? <p className="organizer-error" role="alert">Sign-out failed. Try again.</p> : null}
    </div>
  );
}

function Dashboard({ client, onAccessChanged, timeZone }: {
  client: SupabaseClient;
  onAccessChanged: () => void;
  timeZone: string;
}) {
  const { config } = useEventContent();
  const [revision, setRevision] = useState(0);
  const [overview, setOverview] = useState<AttendanceOverview | null>();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    const queueRefresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 250);
    };
    const join = setTimeout(() => {
      channel = client.channel(`organizer-registrations:${nextListenerId++}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, queueRefresh)
        .on('system', {}, (message) => {
          // The PostgreSQL stream can become ready after the channel joins.
          if (message.extension === 'postgres_changes' && message.status === 'ok') queueRefresh();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') queueRefresh();
        });
    }, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') queueRefresh();
    };
    // Poll while visible so transient delivery gaps and midnight rollover are covered.
    const interval = setInterval(refreshWhenVisible, 10_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(interval);
      clearTimeout(join);
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      if (channel) void client.removeChannel(channel);
    };
  }, [client, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOverview(client, controller.signal).then(
      (nextOverview) => {
        if (!controller.signal.aborted) setOverview(nextOverview);
      },
      (error: { code?: string }) => {
        if (controller.signal.aborted) return;
        if (error?.code === '42501' || error?.code === 'PGRST301') onAccessChanged();
        setOverview(null);
      },
    );
    return () => controller.abort();
  }, [client, onAccessChanged, revision]);

  return (
    <div className="organizer">
      <header className="organizer-container organizer-top">
        <div className="organizer-top-inner">
          <a className="organizer-brand" href="/">
            <BrandMark />
            <span>{config.churchName}</span>
          </a>
          <div className="organizer-top-actions">
            <span className="organizer-active" aria-current="page">Organizer dashboard</span>
            <a className="organizer-back" href="/"><ExternalLink size={16} aria-hidden="true" /> Public event link</a>
            <SignOut client={client} />
          </div>
        </div>
      </header>
      <main className="organizer-container organizer-main">
        <AttendanceWorkspace client={client} revision={revision} refresh={refresh} overview={overview} timeZone={timeZone} />
      </main>
    </div>
  );
}

function AttendanceSummary({ overview, refresh, timeZone }: {
  overview: AttendanceOverview | null | undefined; refresh: () => void;
  timeZone: string;
}) {
  return (
    <>
      {overview === null ? (
        <div className="organizer-feedback">
          <p className="organizer-error" role="alert">The attendance totals couldn’t load.</p>
          <button type="button" className="organizer-button" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
        </div>
      ) : null}
      <div className="organizer-metrics" aria-label="Attendance totals" aria-busy={overview === undefined}>
        {metrics.map(({ key, label }) => (
          <div key={key} className="organizer-metric">
            <strong aria-hidden="true">{overview ? countFormatter.format(overview[key]) : '—'}</strong>
            <span>{label}{overview ? <span className="organizer-sr-only"> {countFormatter.format(overview[key])}</span> : null}</span>
          </div>
        ))}
      </div>
      <AttendanceTrend overview={overview} timeZone={timeZone} />
    </>
  );
}

function AttendanceTrend({ overview, timeZone }: { overview: AttendanceOverview | null | undefined; timeZone: string }) {
  const today = organizerToday(timeZone);
  const byDay = new Map(overview?.trend.map((point) => [point.day, point]));
  const days = Array.from({ length: 30 }, (_, index) => addCalendarDays(today, index - 29));
  const largestValue = Math.max(1, ...(overview?.trend.map((point) => point.expected_attendance) ?? []));
  const formatter = (day: string) => chartDayFormatter.format(new Date(`${day}T00:00:00Z`));
  const hasActivity = overview && overview.trend.length > 0;

  return (
    <section className="organizer-panel organizer-trend" aria-labelledby="organizer-trend-title">
      <div className="organizer-panel-header">
        <h2 id="organizer-trend-title">Registration trend</h2>
        {hasActivity ? <p>Past 30 days</p> : null}
      </div>
      {hasActivity ? (
        <>
          <div className="organizer-chart" aria-hidden="true">
            {days.map((day, index) => {
              const registrations = byDay.get(day)?.registrations ?? 0;
              const expected = byDay.get(day)?.expected_attendance ?? 0;
              return (
                <div className="organizer-chart-day" key={day}>
                  <div className="organizer-chart-bars" title={`${formatter(day)} · ${registrations} registrations · ${expected} attendees`}>
                    <span style={{ height: `${(registrations / largestValue) * 100}%` }} />
                    <span style={{ height: `${(expected / largestValue) * 100}%` }} />
                  </div>
                  {index % 7 === 0 || day === today ? <span className="organizer-chart-label">{formatter(day)}</span> : null}
                </div>
              );
            })}
          </div>
          <ul className="organizer-sr-only">
            {overview.trend.map(({ day, registrations, expected_attendance }) => (
              <li key={day}>{formatter(day)}. Registrations {registrations}. Expected attendees {expected_attendance}.</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="organizer-empty">
          <ChartNoAxesCombined size={52} strokeWidth={1.55} aria-hidden="true" />
          <strong>{overview === undefined ? 'Loading registration activity…' : overview ? 'No registration data yet' : 'Registration activity is unavailable.'}</strong>
          {overview ? <p>Trends will appear here once registrations begin.</p> : null}
        </div>
      )}
      <div className="organizer-chart-key" aria-hidden={Boolean(hasActivity)}>
        <span>Registrations</span><span>Total people (incl. guests)</span>
      </div>
    </section>
  );
}

type LoadedRegistrations = { records: RegistrationRecord[]; count: number; key: string };

function AttendanceWorkspace({ client, revision, refresh, overview, timeZone }: {
  client: SupabaseClient;
  revision: number;
  refresh: () => void;
  overview: AttendanceOverview | null | undefined;
  timeZone: string;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<LoadedRegistrations>();
  const [failedKey, setFailedKey] = useState('');
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportRequest = useRef<AbortController | null>(null);
  const { from, to } = filters;
  const invalidDates = Boolean(from && to && from > to);
  const filterKey = JSON.stringify([search, from, to, page]);
  const requestingSearch = search !== filters.search.trim();
  const showResults = !invalidDates && !requestingSearch && result?.key === filterKey;
  const showLoadError = !invalidDates && !requestingSearch && failedKey === filterKey;
  const loading = !invalidDates && !showResults && !showLoadError;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(filters.search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (invalidDates || requestingSearch) return;
    const controller = new AbortController();
    void fetchRegistrations(client, { search, from, to }, {
      offset: page * attendancePageSize, limit: attendancePageSize, signal: controller.signal,
    }, timeZone).then(
      (nextResult) => {
        if (controller.signal.aborted) return;
        if (page > 0 && nextResult.records.length === 0) {
          setPage(Math.max(0, Math.ceil(nextResult.count / attendancePageSize) - 1));
          return;
        }
        setResult({ ...nextResult, key: filterKey });
        setFailedKey('');
      },
      () => {
        if (controller.signal.aborted) return;
        setResult(undefined);
        setFailedKey(filterKey);
      },
    );
    return () => controller.abort();
  }, [client, filterKey, from, invalidDates, page, requestingSearch, revision, search, timeZone, to]);

  useEffect(() => () => exportRequest.current?.abort(), []);

  function updateFilters(field: keyof RegistrationFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(0);
    setExportError('');
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(0);
    setExportError('');
  }

  async function download() {
    if (exportRequest.current) return;
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(true);
    setExportError('');
    try {
      await exportAttendance(client, { search, from, to }, controller.signal, timeZone);
    } catch {
      if (!controller.signal.aborted) {
        setExportError('Couldn’t export attendance. Check your connection and try again.');
      }
    } finally {
      exportRequest.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  }

  return (
    <>
      <div className="organizer-page-heading">
        <h1>{pageHeader}</h1>
        <button type="button" className="organizer-button" onClick={() => void download()} disabled={exporting || !showResults || !result?.count}>
          <ArrowDownToLine size={17} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
      {exportError ? <p className="organizer-error organizer-table-message" role="alert">{exportError}</p> : null}
      <AttendanceSummary overview={overview} refresh={refresh} timeZone={timeZone} />
      <section className="organizer-panel organizer-records" aria-labelledby="organizer-records-title">
        <div className="organizer-panel-header organizer-records-header">
          <h2 id="organizer-records-title">Attendee list</h2>
          <div className="organizer-filters">
            <label className="organizer-search">
              <span className="organizer-sr-only">Search registrations</span>
              <span className="organizer-search-input">
                <Search aria-hidden="true" size={17} />
                <input type="search" value={filters.search} maxLength={160} placeholder="Name, phone, email, or church" onChange={(event) => updateFilters('search', event.target.value)} />
              </span>
            </label>
            <label>From date
              <input type="date" value={from} max={to || undefined} onChange={(event) => updateFilters('from', event.target.value)} />
            </label>
            <label>To date
              <input type="date" value={to} min={from || undefined} onChange={(event) => updateFilters('to', event.target.value)} />
            </label>
            {filters.search || from || to ? (
              <button type="button" className="organizer-button" onClick={clearFilters}>Clear filters</button>
            ) : null}
          </div>
        </div>
        <div aria-busy={loading}>
          {invalidDates ? <p className="organizer-error organizer-table-message" role="alert">The end date must be the same as or later than the start date.</p> : null}
          {loading ? <p className="organizer-table-message" role="status">Loading registrations…</p> : null}
          {showLoadError ? (
            <div className="organizer-table-message organizer-feedback">
              <p className="organizer-error" role="alert">Registrations couldn’t load.</p>
              <button type="button" className="organizer-button" onClick={refresh}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
            </div>
          ) : null}
          {showResults && result ? (
            <RegistrationRows
              records={result.records}
              count={result.count}
              page={page}
              hasFilters={Boolean(search || from || to)}
              timeZone={timeZone}
              onSelect={setSelected}
              onPageChange={setPage}
            />
          ) : null}
        </div>
        {selected ? <RegistrationDetails record={selected} timeZone={timeZone} dismiss={() => setSelected(null)} /> : null}
      </section>
    </>
  );
}

function RegistrationRows({ records, count, page, hasFilters, timeZone, onSelect, onPageChange }: {
  records: RegistrationRecord[];
  count: number;
  page: number;
  hasFilters: boolean;
  timeZone: string;
  onSelect: (record: RegistrationRecord) => void;
  onPageChange: (nextPage: number) => void;
}) {
  const firstRecord = countFormatter.format(page * attendancePageSize + 1);
  const lastRecord = countFormatter.format(page * attendancePageSize + records.length);
  return (
    <>
      <div className="organizer-table-scroll" role="region" aria-label="Attendee registration records" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Full name</th>
              <th scope="col">Phone</th>
              <th scope="col">Email</th>
              <th scope="col">Fellowship</th>
              <th scope="col">Additional guests</th>
              <th scope="col">Total people</th>
              <th scope="col">Registered</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <th scope="row">{record.full_name}</th>
                <td>{record.phone_number}</td>
                <td>{record.email || '—'}</td>
                <td>{record.church_or_fellowship || '—'}</td>
                <td>{record.additional_guests}</td>
                <td>{record.total_attendees}</td>
                <td>{formatRegistrationDate(record.created_at, timeZone)}</td>
                <td>
                  <button type="button" className="organizer-details-button" aria-label={`View registration for ${record.full_name}`} onClick={() => onSelect(record)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length ? (
        <div className="organizer-pagination">
          <p>{firstRecord}–{lastRecord} of {countFormatter.format(count)} registrations</p>
          <div>
            <button type="button" aria-label="Previous page" className="organizer-button organizer-icon-button" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} /></button>
            <button type="button" aria-label="Next page" className="organizer-button organizer-icon-button" disabled={(page + 1) * attendancePageSize >= count} onClick={() => onPageChange(page + 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
      ) : (
        <div className="organizer-empty">
          <UsersRound size={42} strokeWidth={1.55} aria-hidden="true" />
          <strong>{hasFilters ? 'No registrations match these filters.' : 'Awaiting registrations'}</strong>
          {hasFilters ? null : <p>Registrants will appear here once they register for the event.</p>}
        </div>
      )}
    </>
  );
}

function RegistrationDetails({ record, timeZone, dismiss }: { record: RegistrationRecord; timeZone: string; dismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="organizer-dialog" aria-labelledby="organizer-details-title" onClose={dismiss}>
      <div className="organizer-dialog-heading">
        <span className="organizer-access-icon"><UserRound size={21} aria-hidden="true" /></span>
        <form method="dialog">
          <button type="submit" className="organizer-button organizer-icon-button" aria-label="Close registration details" autoFocus><X size={18} /></button>
        </form>
      </div>
      <h2 id="organizer-details-title">{record.full_name}</h2>
      <dl>
        <div><dt>Phone number</dt><dd>{record.phone_number}</dd></div>
        <div><dt>Email address</dt><dd>{record.email || '—'}</dd></div>
        <div><dt>Gender</dt><dd>{record.gender || '—'}</dd></div>
        <div><dt>Church / fellowship</dt><dd>{record.church_or_fellowship || '—'}</dd></div>
        <div><dt>Additional guests</dt><dd>{record.additional_guests}</dd></div>
        <div><dt>Total people</dt><dd>{record.total_attendees}</dd></div>
        <div><dt>Registered</dt><dd>{formatRegistrationDate(record.created_at, timeZone, true)}</dd></div>
      </dl>
    </dialog>
  );
}
