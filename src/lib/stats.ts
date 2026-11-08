// Anonymous usage counts, shared by the app (what it sends), the server (how
// it stores them) and the admin (how it reads them).
//
// Only totals per day are kept: how many times each audio guide was played,
// each route opened, each place reached with Near me, and each place's
// "Was this helpful?" votes, with the reason picked after a No. No cookies, no visitor or device IDs, no IP
// addresses, no timestamps finer than a day.

/** Why a place's page wasn't helpful, picked after "No". */
export const REASONS = ['outdated', 'short', 'location', 'audio', 'other'] as const;
export type Reason = (typeof REASONS)[number];
const isReason = (r: unknown): r is Reason => (REASONS as readonly unknown[]).includes(r);

/** Why a finished walk got a low rating (1 or 2 stars), picked after it. */
export const ROUTE_REASONS = ['long', 'hot', 'lost', 'closed', 'other'] as const;
export type RouteReason = (typeof ROUTE_REASONS)[number];
const isRouteReason = (r: unknown): r is RouteReason => (ROUTE_REASONS as readonly unknown[]).includes(r);
export type Stars = 1 | 2 | 3 | 4 | 5;
const isStars = (s: unknown): s is Stars => Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 5;

export type StatEvent =
  | { t: 'play' | 'arrive' | 'up' | 'down'; id: number }
  | { t: 'route'; id: string }
  | { t: 'why'; id: number; r: Reason }
  /** "How was the walk?" on the finish screen. */
  | { t: 'rate'; id: string; s: Stars }
  | { t: 'rwhy'; id: string; r: RouteReason };

/** One day's totals, keyed by place ID or route ID. */
export interface DayStats {
  plays: Record<string, number>;
  routes: Record<string, number>;
  arrivals: Record<string, number>;
  /** "Was this helpful?" yes and no votes, by place. */
  helpful: Record<string, number>;
  unhelpful: Record<string, number>;
  /** The reasons given after "No", keyed "placeId:reason", e.g. "12:outdated". */
  reasons: Record<string, number>;
  /** Finished-walk ratings, keyed "routeId:stars", e.g. "al-muizz:4". */
  ratings: Record<string, number>;
  /** Reasons after a low rating, keyed "routeId:reason", e.g. "al-muizz:hot". */
  routeReasons: Record<string, number>;
}

const FIELDS = ['plays', 'routes', 'arrivals', 'helpful', 'unhelpful', 'reasons', 'ratings', 'routeReasons'] as const;
const REASON_KEY = new RegExp(`^\\d+:(${REASONS.join('|')})$`);
const ROUTE_ID = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RATING_KEY = new RegExp(`^${ROUTE_ID}:[1-5]$`);
const ROUTE_REASON_KEY = new RegExp(`^${ROUTE_ID}:(${ROUTE_REASONS.join('|')})$`);

export const emptyDay = (): DayStats => ({ plays: {}, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {} });

/** The most events one request may carry. */
export const MAX_EVENTS_PER_REQUEST = 50;

const FIELD = { play: 'plays', route: 'routes', arrive: 'arrivals', up: 'helpful', down: 'unhelpful', why: 'reasons', rate: 'ratings', rwhy: 'routeReasons' } as const;

/** Checks events from a visitor, keeping only well-formed ones for known places and routes. */
export function cleanEvents(raw: unknown, known: { placeIds: Set<number>; routeIds: Set<string> }): StatEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: StatEvent[] = [];
  for (const e of raw.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!e || typeof e !== 'object') continue;
    const { t, id, r } = e as { t?: unknown; id?: unknown; r?: unknown };
    if (t === 'why' && typeof id === 'number' && known.placeIds.has(id) && isReason(r)) out.push({ t, id, r });
    else if ((t === 'play' || t === 'arrive' || t === 'up' || t === 'down') && typeof id === 'number' && known.placeIds.has(id)) out.push({ t, id });
    else if (t === 'route' && typeof id === 'string' && known.routeIds.has(id)) out.push({ t, id });
    else if (t === 'rate' && typeof id === 'string' && known.routeIds.has(id) && isStars((e as { s?: unknown }).s)) out.push({ t, id, s: (e as { s: Stars }).s });
    else if (t === 'rwhy' && typeof id === 'string' && known.routeIds.has(id) && isRouteReason(r)) out.push({ t, id, r });
  }
  return out;
}

/** Adds events to a day's totals (returns a new object). */
export function addEvents(day: DayStats, events: StatEvent[]): DayStats {
  const next = Object.fromEntries(FIELDS.map(f => [f, { ...day[f] }])) as unknown as DayStats;
  for (const e of events) {
    const bucket = next[FIELD[e.t]];
    const key = e.t === 'why' || e.t === 'rwhy' ? `${e.id}:${e.r}` : e.t === 'rate' ? `${e.id}:${e.s}` : e.id;
    bucket[key] = (bucket[key] ?? 0) + 1;
  }
  return next;
}

/** Reads a stored day, dropping anything malformed. */
export function parseDay(raw: unknown): DayStats {
  const day = emptyDay();
  if (!raw || typeof raw !== 'object') return day;
  for (const field of FIELDS) {
    const src = (raw as Record<string, unknown>)[field];
    if (!src || typeof src !== 'object') continue;
    for (const [k, v] of Object.entries(src)) {
      if (field === 'reasons' && !REASON_KEY.test(k)) continue;
      if (field === 'ratings' && !RATING_KEY.test(k)) continue;
      if (field === 'routeReasons' && !ROUTE_REASON_KEY.test(k)) continue;
      if (Number.isInteger(v) && (v as number) > 0) day[field][k] = v as number;
    }
  }
  return day;
}

/** Adds up several days. */
export const sumDays = (days: DayStats[]): DayStats => {
  const total = emptyDay();
  for (const d of days) {
    for (const field of FIELDS) {
      for (const [k, v] of Object.entries(d[field])) total[field][k] = (total[field][k] ?? 0) + v;
    }
  }
  return total;
};

/** A UTC date as YYYY-MM-DD. */
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export type HelpfulRow = { id: number; yes: number; no: number; votes: number; pct: number; reasons: Partial<Record<Reason, number>> };

/**
 * Each place's "Was this helpful?" votes, for the admin: most disliked first
 * (most No votes, then the lowest share of Yes), or most votes first.
 */
export function helpfulness(total: DayStats, placeIds: number[], sort: 'disliked' | 'votes' = 'disliked'): HelpfulRow[] {
  const rows = placeIds
    .map(id => {
      const yes = total.helpful[id] ?? 0;
      const no = total.unhelpful[id] ?? 0;
      const votes = yes + no;
      const reasons: Partial<Record<Reason, number>> = {};
      for (const r of REASONS) if (total.reasons[`${id}:${r}`]) reasons[r] = total.reasons[`${id}:${r}`];
      return { id, yes, no, votes, pct: votes ? Math.round((yes / votes) * 100) : 0, reasons };
    })
    .filter(r => r.votes > 0);
  return rows.sort((a, b) => (sort === 'votes' ? b.votes - a.votes : b.no - a.no || a.pct - b.pct) || a.id - b.id);
}

export type RatingRow = { id: string; count: number; average: number; reasons: Partial<Record<RouteReason, number>> };

/** Each route's finished-walk ratings: how many, the average (one decimal), and the reasons after low ones. Routes without ratings are left out. */
export function routeRatings(total: DayStats, routeIds: string[]): RatingRow[] {
  return routeIds
    .map(id => {
      let count = 0;
      let sum = 0;
      for (let s = 1; s <= 5; s++) {
        const n = total.ratings[`${id}:${s}`] ?? 0;
        count += n;
        sum += n * s;
      }
      const reasons: Partial<Record<RouteReason, number>> = {};
      for (const r of ROUTE_REASONS) if (total.routeReasons[`${id}:${r}`]) reasons[r] = total.routeReasons[`${id}:${r}`];
      return { id, count, average: count ? Math.round((sum / count) * 10) / 10 : 0, reasons };
    })
    .filter(r => r.count > 0);
}
