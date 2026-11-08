// The Stats tab as a spreadsheet: one CSV file with a section per table, for
// keeping the numbers or sharing them outside the admin.

import type { Content } from '../data/content';
import { walkStops } from '../lib/walk';
import { REASONS, type Reason } from '../lib/stats';
import { CSV_TYPE, csvText } from './backup';
import type { StatsResponse } from './api';

export type DailyRow = { date: string; plays: number; routes: number; arrivals: number };

/** One row per day of the period, oldest first, with days that had nothing as zeros. Dates are UTC, as the server stores them. */
export function dailySeries(perDay: StatsResponse['perDay'], days: number, today = new Date()): DailyRow[] {
  const byDate = new Map(perDay.map(d => [d.date, d]));
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const d = byDate.get(date);
    return { date, plays: d?.plays ?? 0, routes: d?.routes ?? 0, arrivals: d?.arrivals ?? 0 };
  });
}

const REASON_HEADERS: Record<Reason, string> = {
  outdated: 'No: out of date',
  short: 'No: too short',
  location: 'No: hard to find',
  audio: 'No: audio problem',
  other: 'No: something else',
};

/** The stats for the period shown, as a CSV file. */
export function statsCsv(data: StatsResponse, content: Content, days: number, today = new Date()) {
  const { total } = data;
  const n = (r: Record<string, number>, id: string | number) => r[id] ?? 0;
  const routeName = new Map(content.routes.map(r => [r.id, r.nameEn]));
  const daily = dailySeries(data.perDay, days, today);
  const from = daily[0].date;
  const to = daily[daily.length - 1].date;

  const rows: unknown[][] = [
    ['Cairo Walks stats', `Last ${days} days`, `${from} to ${to} (UTC)`],
    [],
    ['Per day'],
    ['Date', 'Audio plays', 'Route opens', 'Near me arrivals'],
    ...daily.map(d => [d.date, d.plays, d.routes, d.arrivals]),
    ['Total', ...(['plays', 'routes', 'arrivals'] as const).map(k => daily.reduce((a, d) => a + d[k], 0))],
    [],
    ['Per place'],
    ['Place ID', 'Place', 'Route', 'Audio plays', 'Near me arrivals', 'Helpful: yes', 'Helpful: no', ...REASONS.map(r => REASON_HEADERS[r])],
    ...content.places.map(p => [
      p.id,
      p.nameEn,
      routeName.get(p.routeId) ?? p.routeId,
      n(total.plays, p.id),
      n(total.arrivals, p.id),
      n(total.helpful, p.id),
      n(total.unhelpful, p.id),
      ...REASONS.map(r => n(total.reasons, `${p.id}:${r}`)),
    ]),
    [],
    ['Per route'],
    ['Route ID', 'Route', 'Route opens', 'Audio plays at its stops', 'Near me arrivals at its stops'],
    ...content.routes.map(r => {
      const stops = walkStops(content.places, r.id);
      return [r.id, r.nameEn, n(total.routes, r.id), stops.reduce((a, p) => a + n(total.plays, p.id), 0), stops.reduce((a, p) => a + n(total.arrivals, p.id), 0)];
    }),
    [],
    ['Stops in walking order'],
    ['Route', 'Stop', 'Place ID', 'Place', 'Audio plays', 'Near me arrivals'],
    ...content.routes.flatMap(r =>
      walkStops(content.places, r.id).map((p, i) => [r.nameEn, i + 1, p.id, p.nameEn, n(total.plays, p.id), n(total.arrivals, p.id)]),
    ),
  ];
  return { name: `cairo-walks-stats-${days}-days-${to}.csv`, type: CSV_TYPE, text: csvText(rows) };
}
