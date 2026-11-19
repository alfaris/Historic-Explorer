// Anonymous usage counts, shared by the app (what it sends), the server (how
// it stores them) and the admin (how it reads them).
//
// Only totals per day are kept: how many times each audio guide was played,
// each route opened, each place reached with Near me, and each place's
// "Was this helpful?" votes, with the reason picked after a No, how much of
// each recorded audio guide was heard (in quarters), and the interface
// language of audio plays and route opens. No cookies, no visitor or device IDs, no IP
// addresses, no timestamps finer than a day.

import { LANGS, type Lang } from '../i18n/lang.js';

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

const isLang = (l: unknown): l is Lang => (LANGS as readonly unknown[]).includes(l);

/**
 * How much of a recorded audio guide was heard before it stopped: under a
 * quarter, under half, under three quarters, more, or to the end.
 */
export const LISTEN_BANDS = ['q1', 'q2', 'q3', 'q4', 'done'] as const;
export type ListenBand = (typeof LISTEN_BANDS)[number];
const isBand = (b: unknown): b is ListenBand => (LISTEN_BANDS as readonly unknown[]).includes(b);

/** The band for a share of the recording heard (0 to 1). The last few seconds count as the end. */
export function listenBand(heard: number, duration: number): ListenBand {
  if (!Number.isFinite(heard) || !Number.isFinite(duration) || duration <= 0) return 'q1';
  if (heard >= duration - 2) return 'done';
  const share = heard / duration;
  return share < 0.25 ? 'q1' : share < 0.5 ? 'q2' : share < 0.75 ? 'q3' : 'q4';
}

/** The longest search kept, and how many different ones a day keeps (the rest aren't counted). */
export const MISS_MAX_LENGTH = 40;
export const MAX_MISSES_PER_DAY = 300;

/** Longer searches aren't place names (and aren't counted at all). */
const MISS_MAX_INPUT = 80;

/**
 * A search as it's counted: lowercased, spaces collapsed, at most
 * MISS_MAX_LENGTH characters. Null for anything that could identify someone
 * or isn't a place name: an email or web address (any dot followed by a
 * letter), a phone or other number (5 or more digits), symbols, fewer than 2
 * letters, or more than 80 characters. The whole search is checked before it
 * is shortened, so nothing identifying past the cut can slip through.
 */
export function missQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const full = raw.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  if (full.length > MISS_MAX_INPUT) return null;
  if ((full.match(/\p{L}/gu) ?? []).length < 2) return null;
  if (!/^[\p{L}\p{M}\p{N} '’.-]+$/u.test(full)) return null;
  if ((full.match(/\p{N}/gu) ?? []).length >= 5 || /\.\p{L}/u.test(full)) return null;
  const q = full.slice(0, MISS_MAX_LENGTH).trim();
  return q.length >= 2 ? q : null;
}

/** Whether band `a` heard more than band `b`. */
export const furtherBand = (a: ListenBand, b: ListenBand) => LISTEN_BANDS.indexOf(a) > LISTEN_BANDS.indexOf(b);

export type StatEvent =
  /** Audio plays and route opens carry the interface language (`l`). */
  | { t: 'play'; id: number; l?: Lang }
  | { t: 'arrive' | 'up' | 'down'; id: number }
  | { t: 'route'; id: string; l?: Lang }
  | { t: 'why'; id: number; r: Reason }
  /** "How was the walk?" on the finish screen. */
  | { t: 'rate'; id: string; s: Stars }
  | { t: 'rwhy'; id: string; r: RouteReason }
  /**
   * How much of a recorded audio guide was heard, once per place per visit.
   * When the visitor later gets further, a new event carries the band it
   * replaces (`w`) and the UTC day it was counted on (`d`), so the count
   * moves from that band to the new one on that day.
   */
  | { t: 'listen'; id: number; b: ListenBand; w?: ListenBand; d?: string }
  /** A search that found no place, as missQuery gives it. */
  | { t: 'miss'; q: string }
  /** A finished "Which came first?" game on a route: right answers `s` of `n` rounds (first game per route per visit). */
  | { t: 'quiz'; id: string; s: number; n: number };

/** Where a batch of events (or a report) came from: the web app, or a native app and its build. */
export const CLIENTS = ['web', 'android', 'ios'] as const;
export type Client = (typeof CLIENTS)[number];
export type ClientInfo = { client: Client; appVersion?: number };

/** The client a request names (`client`, and `appVersion` for the apps), or null for older requests that don't say. */
export function cleanClient(raw: unknown): ClientInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const { client, appVersion } = raw as { client?: unknown; appVersion?: unknown };
  if (!(CLIENTS as readonly unknown[]).includes(client)) return null;
  const ok = client !== 'web' && Number.isInteger(appVersion) && (appVersion as number) >= 1 && (appVersion as number) <= 999_999;
  return ok ? { client: client as Client, appVersion: appVersion as number } : { client: client as Client };
}

/** The most app builds a day counts for each client. */
export const MAX_BUILDS_PER_DAY = 20;

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
  /** Audio plays and route opens by interface language, keyed "play:fr" or "route:ar". Absent on days before it was recorded. */
  langs: Record<string, number>;
  /** How much of each recorded guide was heard, keyed "placeId:band", e.g. "12:done". Absent on days before it was recorded. */
  listens: Record<string, number>;
  /** Searches that found no place, by query (see missQuery). Absent on days before it was recorded. */
  misses: Record<string, number>;
  /**
   * "Which came first?" games per route, keyed "routeId:g" (games), "routeId:r"
   * (right answers) and "routeId:n" (rounds). Absent on days before it was recorded.
   */
  quiz: Record<string, number>;
  /**
   * Events by where they came from, keyed "web", "android", "ios", and by app
   * build, keyed "android:12". Absent on days before it was recorded.
   */
  clients: Record<string, number>;
}

const FIELDS = ['plays', 'routes', 'arrivals', 'helpful', 'unhelpful', 'reasons', 'ratings', 'routeReasons', 'langs', 'listens', 'misses', 'quiz', 'clients'] as const;
const REASON_KEY = new RegExp(`^\\d+:(${REASONS.join('|')})$`);
const ROUTE_ID = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RATING_KEY = new RegExp(`^${ROUTE_ID}:[1-5]$`);
const ROUTE_REASON_KEY = new RegExp(`^${ROUTE_ID}:(${ROUTE_REASONS.join('|')})$`);
const LANG_KEY = new RegExp(`^(play|route):(${LANGS.join('|')})$`);
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const LISTEN_KEY = new RegExp(`^\\d+:(${LISTEN_BANDS.join('|')})$`);
const QUIZ_KEY = new RegExp(`^${ROUTE_ID}:[grn]$`);
const CLIENT_KEY = /^(web|android|ios)(:[1-9]\d{0,5})?$/;
/** The most rounds a game has (see quiz.ts); anything more is made up. */
export const QUIZ_MAX_ROUNDS = 5;

export const emptyDay = (): DayStats => ({ plays: {}, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {}, langs: {}, listens: {}, misses: {}, quiz: {}, clients: {} });

/** The most events one request may carry. */
export const MAX_EVENTS_PER_REQUEST = 50;

const FIELD = { play: 'plays', route: 'routes', arrive: 'arrivals', up: 'helpful', down: 'unhelpful', why: 'reasons', rate: 'ratings', rwhy: 'routeReasons', listen: 'listens', miss: 'misses' } as const;

/** The event with its language, when the visitor sent a known one. */
const withLang = <E extends { t: 'play' | 'route' }>(event: E, raw: object): E => {
  const l = (raw as { l?: unknown }).l;
  return isLang(l) ? { ...event, l } : event;
};

/** Checks events from a visitor, keeping only well-formed ones for known places and routes. */
export function cleanEvents(raw: unknown, known: { placeIds: Set<number>; routeIds: Set<string> }): StatEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: StatEvent[] = [];
  for (const e of raw.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!e || typeof e !== 'object') continue;
    const { t, id, r } = e as { t?: unknown; id?: unknown; r?: unknown };
    if (t === 'miss') {
      const q = missQuery((e as { q?: unknown }).q);
      if (q) out.push({ t, q });
      continue;
    }
    if (t === 'quiz') {
      const { s, n } = e as { s?: unknown; n?: unknown };
      const ok = typeof id === 'string' && known.routeIds.has(id) && Number.isInteger(n) && Number.isInteger(s);
      if (ok && (n as number) >= 1 && (n as number) <= QUIZ_MAX_ROUNDS && (s as number) >= 0 && (s as number) <= (n as number)) out.push({ t, id: id as string, s: s as number, n: n as number });
      continue;
    }
    if (t === 'why' && typeof id === 'number' && known.placeIds.has(id) && isReason(r)) out.push({ t, id, r });
    else if (t === 'play' && typeof id === 'number' && known.placeIds.has(id)) out.push(withLang({ t, id }, e));
    else if ((t === 'arrive' || t === 'up' || t === 'down') && typeof id === 'number' && known.placeIds.has(id)) out.push({ t, id });
    else if (t === 'route' && typeof id === 'string' && known.routeIds.has(id)) out.push(withLang({ t, id }, e));
    else if (t === 'rate' && typeof id === 'string' && known.routeIds.has(id) && isStars((e as { s?: unknown }).s)) out.push({ t, id, s: (e as { s: Stars }).s });
    else if (t === 'rwhy' && typeof id === 'string' && known.routeIds.has(id) && isRouteReason(r)) out.push({ t, id, r });
    else if (t === 'listen' && typeof id === 'number' && known.placeIds.has(id) && isBand((e as { b?: unknown }).b)) {
      const b = (e as { b: ListenBand }).b;
      const w = (e as { w?: unknown }).w;
      // A replaced band must be one the visitor got less far than.
      const d = (e as { d?: unknown }).d;
      if (w === undefined) out.push({ t, id, b });
      else if (isBand(w) && furtherBand(b, w)) out.push(typeof d === 'string' && DAY_KEY.test(d) ? { t, id, b, w, d } : { t, id, b, w });
    }
  }
  return out;
}

/** Adds events to a day's totals (returns a new object), counting them under the client that sent them, if it said. */
export function addEvents(day: DayStats, events: StatEvent[], from?: ClientInfo | null): DayStats {
  const next = Object.fromEntries(FIELDS.map(f => [f, { ...day[f] }])) as unknown as DayStats;
  for (const e of events) {
    if (e.t === 'miss') {
      // A day keeps at most MAX_MISSES_PER_DAY different searches.
      if (next.misses[e.q] === undefined && Object.keys(next.misses).length >= MAX_MISSES_PER_DAY) continue;
      next.misses[e.q] = (next.misses[e.q] ?? 0) + 1;
      continue;
    }
    if (e.t === 'quiz') {
      const add = (k: string, v: number) => {
        if (v) next.quiz[`${e.id}:${k}`] = (next.quiz[`${e.id}:${k}`] ?? 0) + v;
      };
      add('g', 1);
      add('r', e.s);
      add('n', e.n);
      continue;
    }
    const bucket = next[FIELD[e.t]];
    const key = e.t === 'why' || e.t === 'rwhy' ? `${e.id}:${e.r}` : e.t === 'rate' ? `${e.id}:${e.s}` : e.t === 'listen' ? `${e.id}:${e.b}` : e.id;
    bucket[key] = (bucket[key] ?? 0) + 1;
    // A listen arriving after its correction brings that band back to zero.
    if (bucket[key] === 0) delete bucket[key];
    if ((e.t === 'play' || e.t === 'route') && e.l) next.langs[`${e.t}:${e.l}`] = (next.langs[`${e.t}:${e.l}`] ?? 0) + 1;
    // A listen that got further than one already counted: move it out of the band it replaces.
    // The correction may arrive before the listen it corrects (separate requests), so the
    // band can go below zero until that listen arrives: the total is the same in either order.
    if (e.t === 'listen' && e.w) {
      const was = `${e.id}:${e.w}`;
      const n = (next.listens[was] ?? 0) - 1;
      if (n === 0) delete next.listens[was];
      else next.listens[was] = n;
    }
  }
  // Listen corrections only move an earlier count, so they aren't new events here.
  const counted = events.filter(e => !(e.t === 'listen' && e.w)).length;
  if (from && counted) {
    next.clients[from.client] = (next.clients[from.client] ?? 0) + counted;
    const build = from.appVersion && `${from.client}:${from.appVersion}`;
    // A day keeps at most MAX_BUILDS_PER_DAY builds per client (made-up builds can't grow the file); others count in the client total only.
    const builds = Object.keys(next.clients).filter(k => k.startsWith(`${from.client}:`)).length;
    if (build && (next.clients[build] !== undefined || builds < MAX_BUILDS_PER_DAY)) next.clients[build] = (next.clients[build] ?? 0) + counted;
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
      if (field === 'langs' && !LANG_KEY.test(k)) continue;
      if (field === 'listens' && !LISTEN_KEY.test(k)) continue;
      if (field === 'misses' && missQuery(k) !== k) continue;
      if (field === 'quiz' && !QUIZ_KEY.test(k)) continue;
      if (field === 'clients' && !CLIENT_KEY.test(k)) continue;
      // Listens can be below zero for a while (a correction ahead of its listen); everything else is a count.
      if (Number.isInteger(v) && ((v as number) > 0 || (field === 'listens' && (v as number) < 0))) day[field][k] = v as number;
    }
  }
  return day;
}

/** Adds up several days. */
export const sumDays = (days: DayStats[]): DayStats => {
  const total = emptyDay();
  for (const d of days) {
    for (const field of FIELDS) {
      // Older totals may have no listens.
      for (const [k, v] of Object.entries(d[field] ?? {})) total[field][k] = (total[field][k] ?? 0) + v;
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

export type QuizRow = { id: string; games: number; right: number; rounds: number; pct: number };

/** Each route's "Which came first?" games and the share of right answers (in %). Routes without games are left out. */
export function quizStats(total: DayStats, routeIds: string[]): QuizRow[] {
  const q = total.quiz ?? {};
  return routeIds
    .map(id => {
      const rounds = q[`${id}:n`] ?? 0;
      const right = Math.min(q[`${id}:r`] ?? 0, rounds);
      return { id, games: q[`${id}:g`] ?? 0, right, rounds, pct: rounds ? Math.round((right / rounds) * 100) : 0 };
    })
    .filter(r => r.games > 0);
}

export type LanguageRow = { lang: Lang; plays: number; routes: number; total: number; pct: number };

/**
 * Audio plays and route opens per interface language, most used first, with
 * each one's share. `counted` is how many plays and opens had a language and
 * `all` how many there were: days before languages were recorded have none.
 */
export function languageShares(total: DayStats): { rows: LanguageRow[]; counted: number; all: number } {
  const count = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  // An older server's totals may have no languages.
  const langs = total.langs ?? {};
  const rows = LANGS.map(lang => {
    const plays = langs[`play:${lang}`] ?? 0;
    const routes = langs[`route:${lang}`] ?? 0;
    return { lang, plays, routes, total: plays + routes, pct: 0 };
  });
  const counted = rows.reduce((a, r) => a + r.total, 0);
  for (const r of rows) r.pct = counted ? Math.round((r.total / counted) * 100) : 0;
  return { rows: rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total), counted, all: count(total.plays) + count(total.routes) };
}

export type ListenRow = {
  id: number;
  /** Guides stopped or finished (one per visit). */
  listens: number;
  bands: Record<ListenBand, number>;
  /** Share heard to the end, in %. */
  finished: number;
  /** Share stopped in the first quarter, in %. */
  early: number;
};

/** Fewer listens than this and a place isn't flagged: too few to tell. */
export const MIN_LISTENS = 10;

/**
 * How much of each place's recorded guide was heard, for the admin: lowest
 * finish rate first. Places with no listens are left out.
 */
export function listening(total: DayStats, placeIds: number[]): ListenRow[] {
  const listens = total.listens ?? {};
  return placeIds
    .map(id => {
      // A band below zero (a correction whose listen never arrived) shows as none.
      const bands = Object.fromEntries(LISTEN_BANDS.map(b => [b, Math.max(0, listens[`${id}:${b}`] ?? 0)])) as Record<ListenBand, number>;
      const n = LISTEN_BANDS.reduce((a, b) => a + bands[b], 0);
      return { id, listens: n, bands, finished: n ? Math.round((bands.done / n) * 100) : 0, early: n ? Math.round((bands.q1 / n) * 100) : 0 };
    })
    .filter(r => r.listens > 0)
    .sort((a, b) => a.finished - b.finished || b.listens - a.listens || a.id - b.id);
}

/** Most listeners stop in the first quarter, with enough listens to tell. */
export const mostStopEarly = (r: ListenRow) => r.listens >= MIN_LISTENS && r.early >= 50;

/** The searches that found nothing most often, with their counts. */
export function topMisses(total: DayStats, n = 20): { q: string; count: number }[] {
  return Object.entries(total.misses ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([q, count]) => ({ q, count }));
}

export type ClientRow = { client: Client; events: number; pct: number; builds: { build: number; events: number }[] };

/** Events by where they came from, most first, with each app's builds (newest first). Days before this was recorded aren't counted. */
export function clientShares(total: DayStats): ClientRow[] {
  const counts = total.clients ?? {};
  const all = CLIENTS.reduce((n, c) => n + (counts[c] ?? 0), 0);
  return CLIENTS.filter(c => counts[c])
    .map(client => ({
      client,
      events: counts[client],
      pct: Math.round((counts[client] / all) * 100),
      builds: Object.entries(counts)
        .filter(([k]) => k.startsWith(`${client}:`))
        .map(([k, events]) => ({ build: Number(k.slice(client.length + 1)), events }))
        .sort((a, b) => b.build - a.build),
    }))
    .sort((a, b) => b.events - a.events);
}
