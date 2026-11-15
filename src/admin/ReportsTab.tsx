import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, RefreshCw, X } from 'lucide-react';
import type { Content } from '../data/content';
import { distanceMeters, formatDistance } from '../lib/geo';
import { LANGUAGES } from '../i18n/lang';
import type { PlaceSection } from './content-health';
import { api, ApiError, type Report } from './api';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, formatDate, MapPicker } from './ui';
import { filterPlaces, groupByPlace, reportsLabel, type ReportView } from './report-groups';

const TYPE_LABEL: Record<Report['type'], string> = {
  location: 'Wrong location',
  text: 'Wrong name or description',
  closed: 'Closed / gone',
  photo: 'Photo problem',
};

type Filter = Report['status'] | 'all';

const ALL_VIEW: ReportView = { route: 'all', type: 'all', placeId: null };

export function ReportsTab({ content, save, onEditPlace, onSignedOut, initialPlaceId = null, onPlaceShown }: {
  content: Content;
  save: SaveFn;
  onEditPlace: (placeId: number, section?: PlaceSection) => void;
  onSignedOut: () => void;
  /** Opened from a place's badge in the Places tab: that place's open reports. */
  initialPlaceId?: number | null;
  onPlaceShown?: () => void;
}) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<Report['status'], number> | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [view, setView] = useState<ReportView>(() => (initialPlaceId !== null ? { ...ALL_VIEW, placeId: initialPlaceId } : ALL_VIEW));
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (initialPlaceId === null) return;
    setView({ ...ALL_VIEW, placeId: initialPlaceId });
    setFilter('open');
    onPlaceShown?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlaceId]);

  // Which places the view covers: worked out from the content, but only when the view changes.
  const placesKey = (filterPlaces(content, view) ?? []).join(',');
  const places = view.route === 'all' && view.placeId === null ? undefined : placesKey;

  // Each load gets a number: an answer for an earlier filter is ignored.
  const loadId = useRef(0);
  // Loads the first page for the filter, or the next page when appending.
  const load = useCallback(
    async (append = false, offset = 0) => {
      const id = ++loadId.current;
      try {
        const page = await api.reports(filter, offset, {
          ...(places !== undefined ? { places: places ? places.split(',').map(Number) : [] } : {}),
          ...(view.type !== 'all' ? { type: view.type } : {}),
        });
        if (id !== loadId.current) return;
        setReports(rs => (append && rs ? [...rs, ...page.reports] : page.reports));
        setTotal(page.total);
        setCounts(page.counts);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return onSignedOut();
        if (id === loadId.current) setError((err as Error).message);
      }
    },
    [filter, places, view.type, onSignedOut],
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
  const groups = groupByPlace(shown);
  const placeName = (id: number) => content.places.find(p => p.id === id)?.nameEn ?? shown.find(r => r.placeId === id)?.placeName ?? `Place ${id}`;
  const select = 'rounded-lg border border-sand/60 bg-white px-2 py-1.5 text-xs text-stone-700';

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

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {view.placeId !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 border border-gold/40 ps-3 pe-1 py-0.5 text-xs font-bold text-ink">
            Only {placeName(view.placeId)}
            <button
              onClick={() => setView(v => ({ ...v, placeId: null }))}
              className="rounded-full p-1 hover:bg-gold/20"
              aria-label="Show reports about every place"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            Route
            <select value={view.route} onChange={e => setView(v => ({ ...v, route: e.target.value }))} className={select}>
              <option value="all">All routes</option>
              {content.routes.map(r => (
                <option key={r.id} value={r.id}>{r.nameEn}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          Type
          <select value={view.type} onChange={e => setView(v => ({ ...v, type: e.target.value as ReportView['type'] }))} className={select}>
            <option value="all">All types</option>
            {(Object.keys(TYPE_LABEL) as Report['type'][]).map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        {(view.route !== 'all' || view.type !== 'all' || view.placeId !== null) && (
          <button onClick={() => setView(ALL_VIEW)} className="text-xs text-nile underline underline-offset-2">
            Clear filters
          </button>
        )}
      </div>

      <DigestSettings />
      {error && <ErrorBox message={error} />}
      {!reports ? (
        <p className="text-stone-500">Loading reports…</p>
      ) : shown.length === 0 ? (
        <p className="text-stone-500 bg-white rounded-2xl border border-sand/50 p-8 text-center">
          No {filter === 'all' ? '' : filter} reports{view.route !== 'all' || view.type !== 'all' || view.placeId !== null ? ' match these filters' : ''}.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <section key={g.placeId} aria-label={placeName(g.placeId)}>
              {g.reports.length > 1 && (
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                  {placeName(g.placeId)} · {reportsLabel(g.reports.length)}
                </h3>
              )}
              <ul className="space-y-4">
                {g.reports.map(r => (
                  <ReportCard key={r.id} report={r} content={content} save={save} setStatus={setStatus} onEditPlace={onEditPlace} />
                ))}
              </ul>
            </section>
          ))}
        </div>
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

function ReportCard({ report, content, save, setStatus, onEditPlace, onUsePosition }: {
  report: Report;
  content: Content;
  save: SaveFn;
  setStatus: (r: Report, s: Report['status']) => Promise<void>;
  onEditPlace?: (id: number, section?: PlaceSection) => void;
  /**
   * In the place editor: put the suggested spot in the open draft rather
   * than saving it straight away, so the draft and the content don't differ.
   */
  onUsePosition?: (pos: { lat: number; lng: number }) => void;
}) {
  const inEditor = !!onUsePosition;
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
          inEditor ? (
            <Button type="button" onClick={() => onUsePosition!({ lat: report.suggested!.lat, lng: report.suggested!.lng })} disabled={busy}>
              Use this position
            </Button>
          ) : (
            <Button onClick={applyLocation} disabled={busy}>
              Apply new position
            </Button>
          )
        )}
        {!inEditor && report.status === 'open' && report.type === 'closed' && place && (
          <Button variant="danger" onClick={deletePlace} disabled={busy}>
            Delete place
          </Button>
        )}
        {onEditPlace && report.type === 'closed' && place && (
          <Button variant="secondary" onClick={() => onEditPlace(place.id, 'hours')} disabled={busy}>
            Edit opening hours
          </Button>
        )}
        {onEditPlace && place && (
          <Button variant="secondary" onClick={() => onEditPlace(place.id)} disabled={busy}>
            Edit place
          </Button>
        )}
        {report.status === 'open' ? (
          <>
            <Button type="button" variant="secondary" onClick={() => run(() => setStatus(report, 'resolved'))} disabled={busy}>
              Mark resolved
            </Button>
            <Button type="button" variant="secondary" onClick={() => run(() => setStatus(report, 'dismissed'))} disabled={busy}>
              Dismiss
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => run(() => setStatus(report, 'open'))} disabled={busy}>
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * A place's open reports, in its editor, to resolve or dismiss there. A
 * suggested position goes into the draft (`onUsePosition`) to be saved with it.
 */
export function PlaceReports({ placeId, content, save, onUsePosition, onChanged }: {
  placeId: number;
  content: Content;
  save: SaveFn;
  onUsePosition: (pos: { lat: number; lng: number }) => void;
  /** A report was resolved, dismissed or reopened. */
  onChanged?: () => void;
}) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // An answer for another place, or an earlier load, is ignored.
  const loadId = useRef(0);
  // The first page, or the next one when appending.
  const load = useCallback(async (append = false, offset = 0) => {
    const id = ++loadId.current;
    try {
      const page = await api.reports('open', offset, { places: [placeId] });
      if (id !== loadId.current) return;
      setReports(rs => (append && rs ? [...rs, ...page.reports] : page.reports));
      setTotal(page.total);
      setError(null);
    } catch (err) {
      if (id === loadId.current) setError((err as Error).message);
    }
  }, [placeId]);
  useEffect(() => {
    setReports(null);
    load();
  }, [load]);

  const setStatus = async (report: Report, status: Report['status']) => {
    try {
      await api.updateReport(report.id, { status });
      onChanged?.();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!reports || reports.length === 0) return null;
  return (
    <div id="reports" className="scroll-mt-24 rounded-2xl border border-gold/50 bg-gold/5 p-4">
      <p className="text-xs font-bold text-stone-600 mb-3">Open visitor reports · {reportsLabel(total)}</p>
      <ul className="space-y-3">
        {reports.map(r => (
          <ReportCard key={r.id} report={r} content={content} save={save} setStatus={setStatus} onUsePosition={onUsePosition} />
        ))}
      </ul>
      {reports.length < total && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await load(true, reports.length);
            setLoadingMore(false);
          }}
        >
          {loadingMore ? 'Loading…' : `Load more (${total - reports.length} older)`}
        </Button>
      )}
    </div>
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
