import React, { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import type { Content } from '../data/content';
import { distanceMeters, formatDistance } from '../lib/geo';
import { LANGUAGES } from '../i18n/lang';
import { api, ApiError, type Report } from './api';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, formatDate, MapPicker } from './ui';

const TYPE_LABEL: Record<Report['type'], string> = {
  location: 'Wrong location',
  text: 'Wrong name or description',
  closed: 'Closed / gone',
  photo: 'Photo problem',
};

type Filter = Report['status'] | 'all';

export function ReportsTab({ content, save, onEditPlace, onSignedOut }: {
  content: Content;
  save: SaveFn;
  onEditPlace: (placeId: number, section?: 'hours') => void;
  onSignedOut: () => void;
}) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<Report['status'], number> | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Loads the first page for the filter, or the next page when appending.
  const load = useCallback(
    async (append = false, offset = 0) => {
      try {
        const page = await api.reports(filter, offset);
        setReports(rs => (append && rs ? [...rs, ...page.reports] : page.reports));
        setTotal(page.total);
        setCounts(page.counts);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return onSignedOut();
        setError((err as Error).message);
      }
    },
    [filter, onSignedOut],
  );

  useEffect(() => {
    setReports(null);
    load();
  }, [load]);

  const setStatus = async (report: Report, status: Report['status']) => {
    try {
      await api.updateReport(report.id, { status });
      await load(); // the report moves to another filter, so refresh the list and counts
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const shown = reports ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['open', 'resolved', 'dismissed', 'all'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${filter === f ? 'bg-nile text-white' : 'bg-white border border-sand/60 text-stone-600'}`}
          >
            {f}
            {f !== 'all' && counts ? ` (${counts[f]})` : ''}
          </button>
        ))}
        <button onClick={() => load()} className="ms-auto flex items-center gap-1 text-xs text-stone-500 hover:text-nile">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <DigestSettings />
      {error && <ErrorBox message={error} />}
      {!reports ? (
        <p className="text-stone-500">Loading reports…</p>
      ) : shown.length === 0 ? (
        <p className="text-stone-500 bg-white rounded-2xl border border-sand/50 p-8 text-center">No {filter === 'all' ? '' : filter} reports.</p>
      ) : (
        <ul className="space-y-4">
          {shown.map(r => (
            <ReportCard key={r.id} report={r} content={content} save={save} setStatus={setStatus} onEditPlace={onEditPlace} />
          ))}
        </ul>
      )}
      {reports && shown.length < total && (
        <div className="text-center mt-4">
          <Button
            variant="secondary"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(true, shown.length);
              setLoadingMore(false);
            }}
          >
            {loadingMore ? 'Loading…' : `Load more (${total - shown.length} older)`}
          </Button>
        </div>
      )}
    </section>
  );
}

function ReportCard({ report, content, save, setStatus, onEditPlace }: {
  report: Report;
  content: Content;
  save: SaveFn;
  setStatus: (r: Report, s: Report['status']) => Promise<void>;
  onEditPlace: (id: number, section?: 'hours') => void;
}) {
  const place = content.places.find(p => p.id === report.placeId);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const applyLocation = () =>
    run(async () => {
      if (!place || !report.suggested) return;
      const next: Content = {
        ...content,
        places: content.places.map(p => (p.id === place.id ? { ...p, lat: report.suggested!.lat, lng: report.suggested!.lng } : p)),
      };
      if (await save(next, `Moved "${place.nameEn}" from a visitor report`)) await setStatus(report, 'resolved');
    });

  const deletePlace = () =>
    run(async () => {
      if (!place || !window.confirm(`Delete "${place.nameEn}" from the app? You can restore it from History.`)) return;
      const next: Content = { ...content, places: content.places.filter(p => p.id !== place.id) };
      if (await save(next, `Deleted "${place.nameEn}" (reported closed)`)) await setStatus(report, 'resolved');
    });

  return (
    <li className={`bg-white rounded-2xl border p-5 ${report.status === 'open' ? 'border-gold/50' : 'border-sand/50 opacity-80'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">{TYPE_LABEL[report.type]}</p>
          <p className="text-lg font-serif leading-tight">
            {place ? place.nameEn : report.placeName}
            {!place && <span className="text-xs text-stone-400 font-sans"> (no longer in the app)</span>}
          </p>
        </div>
        <div className="text-end text-xs text-stone-400">
          <p>{formatDate(report.createdAt)}</p>
          <p className="capitalize">
            {report.status}
            {report.lang !== 'en' && LANGUAGES[report.lang] ? ` · sent in ${LANGUAGES[report.lang].english}` : ''}
          </p>
        </div>
      </div>

      {report.message && (
        <p className="text-sm text-stone-700 bg-chalk rounded-xl p-3 mb-3 whitespace-pre-line" dir="auto">
          {report.message}
        </p>
      )}

      {report.type === 'location' && report.suggested && place && (
        <div className="mb-3">
          <p className="text-xs text-stone-500 mb-2">
            Suggested spot (gold) is {formatDistance(distanceMeters(place, report.suggested), false)} from the current one (grey), chosen{' '}
            {report.suggested.source === 'gps'
              ? `by GPS${report.suggested.accuracy ? ` (±${report.suggested.accuracy} m)` : ''}`
              : 'on the map'}
            .
          </p>
          <MapPicker value={report.suggested} reference={place} onChange={() => {}} height={220} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {report.status === 'open' && report.type === 'location' && report.suggested && place && (
          <Button onClick={applyLocation} disabled={busy}>
            Apply new position
          </Button>
        )}
        {report.status === 'open' && report.type === 'closed' && place && (
          <Button variant="danger" onClick={deletePlace} disabled={busy}>
            Delete place
          </Button>
        )}
        {report.type === 'closed' && place && (
          <Button variant="secondary" onClick={() => onEditPlace(place.id, 'hours')} disabled={busy}>
            Edit opening hours
          </Button>
        )}
        {place && (
          <Button variant="secondary" onClick={() => onEditPlace(place.id)} disabled={busy}>
            Edit place
          </Button>
        )}
        {report.status === 'open' ? (
          <>
            <Button variant="secondary" onClick={() => run(() => setStatus(report, 'resolved'))} disabled={busy}>
              Mark resolved
            </Button>
            <Button variant="secondary" onClick={() => run(() => setStatus(report, 'dismissed'))} disabled={busy}>
              Dismiss
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => run(() => setStatus(report, 'open'))} disabled={busy}>
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

/** Whether the daily email of new reports is on, and a way to test it. */
function DigestSettings() {
  const [state, setState] = useState<{ configured: boolean; to: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.digest().then(setState, () => setState(null));
  }, []);
  if (!state) return null;
  const test = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.sendTestEmail();
      setMessage(`Test email sent to ${state.to}.`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-sand/50 px-4 py-3 mb-4 text-xs text-stone-500">
      <Mail className="w-4 h-4 text-gold shrink-0" />
      {state.configured ? (
        <>
          <span className="flex-1 min-w-0">
            Daily email of new reports: <strong className="text-nile">on</strong>, to {state.to} (around 8 am Cairo time, only on days with new reports).
          </span>
          <Button variant="secondary" className="!py-1.5 !px-3" onClick={test} disabled={busy}>
            {busy ? 'Sending…' : 'Send test email'}
          </Button>
        </>
      ) : (
        <span className="flex-1 min-w-0">
          Daily email of new reports: <strong>off</strong>. To turn it on, set <code>RESEND_API_KEY</code>, <code>ADMIN_EMAIL</code> and <code>CRON_SECRET</code> in Vercel (see the README).
        </span>
      )}
      {message && <span className="w-full text-stone-600" role="status">{message}</span>}
    </div>
  );
}
