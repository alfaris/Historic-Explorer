import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { Content } from '../data/content';
import { walkStops } from '../lib/walk';
import { helpfulness, REASONS, ROUTE_REASONS, routeRatings, type HelpfulRow, type Reason, type RouteReason } from '../lib/stats';
import { api, ApiError, type StatsResponse } from './api';
import { downloadFile } from './backup';
import { dailySeries, statsCsv } from './stats-csv';
import { ErrorBox } from './ui';

type Days = 7 | 30 | 90;

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const fmt = (n: number) => n.toLocaleString('en');

/** A thin horizontal bar, its length relative to `max`. One series, so one colour. */
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm" title={`${label}: ${fmt(value)}`}>
      <span className="w-48 shrink-0 truncate text-stone-700">{label}</span>
      <span className="flex-1 h-2.5 rounded-e bg-chalk overflow-hidden">
        <span className="block h-full rounded-e bg-nile" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-12 shrink-0 text-end tabular-nums text-stone-600">{fmt(value)}</span>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-2xl border border-sand/50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="text-3xl font-serif text-ink tabular-nums mt-1">{fmt(value)}</p>
      <p className="text-[11px] text-stone-400 mt-1">{hint}</p>
    </div>
  );
}

/** Audio plays per day as thin columns, with the exact count on hover. */
function Daily({ perDay, days, loadedAt }: { perDay: StatsResponse['perDay']; days: Days; loadedAt: Date }) {
  const series = dailySeries(perDay, days, loadedAt);
  const max = Math.max(1, ...series.map(s => s.plays));
  return (
    <div>
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label={`Audio plays per day over the last ${days} days`}>
        {series.map(s => (
          <div key={s.date} className="group relative flex-1 h-full flex items-end" title={`${s.date}: ${fmt(s.plays)} plays`}>
            <div className="w-full rounded-t bg-nile/80 group-hover:bg-nile" style={{ height: `${s.plays ? Math.max(4, (s.plays / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-stone-400 mt-1 border-t border-sand/60 pt-1">
        <span>{series[0].date}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

const REASON_NAMES: Record<Reason, string> = { outdated: 'out of date', short: 'too short', location: 'hard to find', audio: 'audio problem', other: 'something else' };
/** "2 × out of date · 1 × audio problem", most picked first. */
const reasonText = (r: HelpfulRow) =>
  REASONS.filter(k => r.reasons[k])
    .sort((a, b) => r.reasons[b]! - r.reasons[a]!)
    .map(k => `${r.reasons[k]} × ${REASON_NAMES[k]}`)
    .join(' · ');

const ROUTE_REASON_NAMES: Record<RouteReason, string> = { long: 'too long', hot: 'too hot or tiring', lost: 'hard to follow', closed: 'places closed', other: 'something else' };
/** "3 × too hot or tiring · 1 × places closed", most picked first. */
export const routeReasonText = (reasons: Partial<Record<RouteReason, number>>) =>
  ROUTE_REASONS.filter(k => reasons[k])
    .sort((a, b) => reasons[b]! - reasons[a]!)
    .map(k => `${reasons[k]} × ${ROUTE_REASON_NAMES[k]}`)
    .join(' · ');

export function StatsTab({ content, onSignedOut, onEditPlace }: { content: Content; onSignedOut: () => void; onEditPlace?: (id: number) => void }) {
  const [days, setDays] = useState<Days>(30);
  const [helpSort, setHelpSort] = useState<'disliked' | 'votes'>('disliked');
  const [data, setData] = useState<StatsResponse | null>(null);
  // When `data` was loaded: its days end on that date, even if the tab stays open past midnight.
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // Each load is numbered; only the latest may update the screen, so a slow
  // answer for the previous period can't replace the current one.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await api.stats(days);
      if (request !== latest.current) return;
      setData(next);
      setLoadedAt(new Date());
      setError(null);
    } catch (err) {
      if (request !== latest.current) return;
      if (err instanceof ApiError && err.status === 401) return onSignedOut();
      setError((err as Error).message);
    }
  }, [days, onSignedOut]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const placeName = useMemo(() => new Map(content.places.map(p => [String(p.id), p.nameEn])), [content]);
  const topPlaces = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.total.plays)
      .filter(([id]) => placeName.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [data, placeName]);

  const helpRows = useMemo(
    () => (data ? helpfulness(data.total, content.places.map(p => p.id), helpSort) : []),
    [data, content, helpSort],
  );

  const ratingRows = useMemo(
    () => (data ? routeRatings(data.total, content.routes.map(r => r.id)).sort((a, b) => b.count - a.count) : []),
    [data, content],
  );
  const routeName = useMemo(() => new Map(content.routes.map(r => [r.id, r.nameEn])), [content]);

  const routeRows = useMemo(() => {
    if (!data) return [];
    return content.routes
      .map(r => {
        const stops = walkStops(content.places, r.id).map(p => ({
          name: p.nameEn,
          plays: data.total.plays[p.id] ?? 0,
          arrivals: data.total.arrivals[p.id] ?? 0,
        }));
        return { route: r, opens: data.total.routes[r.id] ?? 0, stops };
      })
      .sort((a, b) => b.opens - a.opens);
  }, [data, content]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {([7, 30, 90] as Days[]).map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${days === d ? 'bg-nile text-white' : 'bg-white border border-sand/60 text-stone-600'}`}
          >
            Last {d} days
          </button>
        ))}
        <button
          onClick={() => data && downloadFile(statsCsv(data, content, days, loadedAt))}
          disabled={!data}
          className="ms-auto flex items-center gap-1 min-h-11 px-2 text-xs text-stone-500 hover:text-nile disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download (CSV)
        </button>
        <button onClick={load} className="flex items-center gap-1 min-h-11 px-2 text-xs text-stone-500 hover:text-nile">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>
      <p className="text-[11px] text-stone-400 -mt-3">
        Anonymous totals per day: no cookies, IDs or IP addresses are stored, and visitors with Do Not Track or Global Privacy Control on aren't counted. Each audio guide, route and arrival counts once per visit; each place's helpful vote, once per device.
      </p>

      {error && <ErrorBox message={error} />}
      {!data ? (
        !error && <p className="text-stone-500">Loading stats…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Tile label="Audio plays" value={sum(data.total.plays)} hint="Audio guides played" />
            <Tile label="Route opens" value={sum(data.total.routes)} hint="Routes viewed" />
            <Tile label="Near me arrivals" value={sum(data.total.arrivals)} hint="Places reached on foot" />
          </div>

          <div className="bg-white rounded-2xl border border-sand/50 p-5">
            <h2 className="text-sm font-bold text-stone-700 mb-3">Audio plays per day</h2>
            <Daily perDay={data.perDay} days={days} loadedAt={loadedAt} />
          </div>

          <div className="bg-white rounded-2xl border border-sand/50 p-5">
            <h2 className="text-sm font-bold text-stone-700 mb-3">Most-played audio guides</h2>
            {topPlaces.length === 0 ? (
              <p className="text-sm text-stone-400">No plays in this period yet.</p>
            ) : (
              <div className="space-y-2">
                {topPlaces.map(([id, n]) => (
                  <Bar key={id} label={placeName.get(id)!} value={n} max={topPlaces[0][1]} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-sand/50 p-5">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-sm font-bold text-stone-700 flex-1">Was this helpful?</h2>
              <label className="text-xs text-stone-600">
                Sort{' '}
                <select value={helpSort} onChange={e => setHelpSort(e.target.value as 'disliked' | 'votes')} className="ms-1 rounded-lg border border-sand/60 bg-white px-2 py-1 text-xs">
                  <option value="disliked">Most “No” first</option>
                  <option value="votes">Most votes first</option>
                </select>
              </label>
            </div>
            <p className="text-[11px] text-stone-400 mb-3">Votes from the end of each place’s card, once per place per device. Many “No” votes usually mean the description or audio needs work; under each place, the reasons visitors picked after “No” (optional, so fewer than the No votes).</p>
            {helpRows.length === 0 ? (
              <p className="text-sm text-stone-400">No votes in this period yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-500 text-start">
                    <th scope="col" className="text-start font-bold pb-2">Place</th>
                    <th scope="col" className="text-end font-bold pb-2">Yes</th>
                    <th scope="col" className="text-end font-bold pb-2">No</th>
                    <th scope="col" className="text-end font-bold pb-2">Helpful</th>
                    {onEditPlace && <th scope="col" className="pb-2"><span className="sr-only">Edit</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/40">
                  {helpRows.map(r => (
                    <tr key={r.id}>
                      <td className="py-1.5 pe-3 text-stone-700">
                        {placeName.get(String(r.id))}
                        {reasonText(r) && <span className="block text-[11px] text-amber-800">{reasonText(r)}</span>}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-stone-600">{fmt(r.yes)}</td>
                      <td className={`py-1.5 text-end tabular-nums ${r.no > r.yes ? 'text-red-700 font-bold' : 'text-stone-600'}`}>{fmt(r.no)}</td>
                      <td className="py-1.5 text-end tabular-nums text-stone-700">{r.pct}%</td>
                      {onEditPlace && (
                        <td className="py-1.5 text-end">
                          <button onClick={() => onEditPlace(r.id)} className="min-h-9 px-2 text-xs font-bold text-nile hover:underline">
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-sand/50 p-5">
            <h2 className="text-sm font-bold text-stone-700 mb-1">How was the walk?</h2>
            <p className="text-[11px] text-stone-400 mb-4">Ratings from the finish screen (1–5 stars, once per route per device), with the reasons given after 1 or 2 stars.</p>
            {ratingRows.length === 0 ? (
              <p className="text-sm text-stone-400">No ratings in this period yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-[11px] uppercase tracking-widest text-stone-400">
                    <th className="text-start font-bold pb-2">Route</th>
                    <th className="text-end font-bold pb-2">Average</th>
                    <th className="text-end font-bold pb-2">Ratings</th>
                    <th className="text-start font-bold pb-2 ps-4">After a low rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/40">
                  {ratingRows.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 text-stone-700">{routeName.get(r.id) ?? r.id}</td>
                      <td className="py-2 text-end tabular-nums text-ink">★ {r.average.toFixed(1)}</td>
                      <td className="py-2 text-end tabular-nums text-stone-600">{fmt(r.count)}</td>
                      <td className="py-2 ps-4 text-xs text-stone-500">{routeReasonText(r.reasons) || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-sand/50 p-5">
            <h2 className="text-sm font-bold text-stone-700 mb-1">How far people get on each route</h2>
            <p className="text-[11px] text-stone-400 mb-4">Audio plays at each stop, in walking order. A falling bar shows where visitors stop following the route.</p>
            <div className="space-y-6">
              {routeRows.map(({ route, opens, stops }) => {
                const max = Math.max(1, ...stops.map(s => s.plays));
                return (
                  <div key={route.id}>
                    <p className="text-sm font-serif text-ink mb-2">
                      {route.nameEn} <span className="font-sans text-xs text-stone-400">· {fmt(opens)} opens</span>
                    </p>
                    {stops.length === 0 ? (
                      <p className="text-xs text-stone-400">No stops.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {stops.map((s, i) => (
                          <Bar key={i} label={`${i + 1}. ${s.name}`} value={s.plays} max={max} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
