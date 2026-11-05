// Anonymous usage counts, shared by the app (what it sends), the server (how
// it stores them) and the admin (how it reads them).
//
// Only totals per day are kept: how many times each audio guide was played,
// each route opened, and each place reached with Near me. No cookies, no
// visitor or device IDs, no IP addresses, no timestamps finer than a day.

export type StatEvent = { t: 'play' | 'arrive'; id: number } | { t: 'route'; id: string };

/** One day's totals, keyed by place ID or route ID. */
export interface DayStats {
  plays: Record<string, number>;
  routes: Record<string, number>;
  arrivals: Record<string, number>;
}

export const emptyDay = (): DayStats => ({ plays: {}, routes: {}, arrivals: {} });

/** The most events one request may carry. */
export const MAX_EVENTS_PER_REQUEST = 50;

const FIELD = { play: 'plays', route: 'routes', arrive: 'arrivals' } as const;

/** Checks events from a visitor, keeping only well-formed ones for known places and routes. */
export function cleanEvents(raw: unknown, known: { placeIds: Set<number>; routeIds: Set<string> }): StatEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: StatEvent[] = [];
  for (const e of raw.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!e || typeof e !== 'object') continue;
    const { t, id } = e as { t?: unknown; id?: unknown };
    if ((t === 'play' || t === 'arrive') && typeof id === 'number' && known.placeIds.has(id)) out.push({ t, id });
    else if (t === 'route' && typeof id === 'string' && known.routeIds.has(id)) out.push({ t, id });
  }
  return out;
}

/** Adds events to a day's totals (returns a new object). */
export function addEvents(day: DayStats, events: StatEvent[]): DayStats {
  const next: DayStats = { plays: { ...day.plays }, routes: { ...day.routes }, arrivals: { ...day.arrivals } };
  for (const e of events) {
    const bucket = next[FIELD[e.t]];
    bucket[e.id] = (bucket[e.id] ?? 0) + 1;
  }
  return next;
}

/** Reads a stored day, dropping anything malformed. */
export function parseDay(raw: unknown): DayStats {
  const day = emptyDay();
  if (!raw || typeof raw !== 'object') return day;
  for (const field of ['plays', 'routes', 'arrivals'] as const) {
    const src = (raw as Record<string, unknown>)[field];
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src)) if (Number.isInteger(v) && (v as number) > 0) day[field][k] = v as number;
  }
  return day;
}

/** Adds up several days. */
export const sumDays = (days: DayStats[]): DayStats => {
  const total = emptyDay();
  for (const d of days) {
    for (const field of ['plays', 'routes', 'arrivals'] as const) {
      for (const [k, v] of Object.entries(d[field])) total[field][k] = (total[field][k] ?? 0) + v;
    }
  }
  return total;
};

/** A UTC date as YYYY-MM-DD. */
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
