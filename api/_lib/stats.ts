// Anonymous usage counts (see src/lib/stats.ts): one small JSON file of totals
// per day in Blob, at stats/days/YYYY-MM-DD.json.
//
//   POST /api/stats {events}   → 204   (from the app, batched per visit)
//   readStats(days)            → totals for the admin's Stats tab
//
// Nothing about the visitor is stored. Their IP is only used, in memory, by
// the rate limit.

import { BlobNotFoundError, BlobPreconditionFailedError, get, list, put } from '@vercel/blob';
import { addEvents, cleanEvents, dayKey, emptyDay, parseDay, sumDays, type DayStats, type StatEvent } from '../../src/lib/stats.js';
import { getContent } from './content.js';
import { createRateLimiter } from './guard.js';
import { hasBlobStore, json, readJson } from './http.js';

const PREFIX = 'stats/days/';
const dayPath = (key: string) => `${PREFIX}${key}.json`;

// A phone sends at most one batch every 30 s (SEND_AFTER_MS in src/lib/track.ts),
// so 2 a minute. A tour group behind one guide's hotspot or hotel Wi-Fi shares
// one address: 120 a minute leaves room for 60 phones while still stopping a
// flood. A refused address is logged once per minute (never the address itself),
// since sendBeacon doesn't retry and the counts would otherwise vanish unseen.
export const STATS_PER_MINUTE = 120;
export const statsRateLimit = createRateLimiter(STATS_PER_MINUTE, 60_000, undefined, () =>
  console.warn(`Stats: refusing requests from one address (over ${STATS_PER_MINUTE} a minute); their counts are lost.`),
);

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

async function readDay(key: string): Promise<{ day: DayStats; etag: string | null }> {
  try {
    const result = await get(dayPath(key), { access: 'private', useCache: false });
    if (!result?.stream) return { day: emptyDay(), etag: null };
    return { day: parseDay(JSON.parse(await new Response(result.stream).text())), etag: result.blob.etag };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return { day: emptyDay(), etag: null };
    throw err;
  }
}

// A tour group's phones can all send at the same moment: each clash waits a
// little longer (with jitter, so they don't clash again in step) before
// re-reading. The waits add up to under 2.5 s, and a request stops retrying at
// its deadline (STATS_DEADLINE_MS for all its batches), so it stays well inside
// the function's time limit.
export const MAX_TRIES = 8;
const BASE_WAIT_MS = 25;
const MAX_WAIT_MS = 800;
/** The longest wait after the given failed try (0-based); the actual wait is a random part of it. */
export const backoffMs = (attempt: number) => Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** attempt);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export const STATS_DEADLINE_MS = 4_000;

/**
 * Adds events to a day's totals. Uses the file's ETag so two requests at the
 * same moment can't overwrite each other's counts; on a clash it waits a
 * moment, re-reads and tries again, up to MAX_TRIES or until `deadline` (a
 * Date.now() time). False when every try clashed.
 */
export async function recordEvents(events: Parameters<typeof addEvents>[1], now = new Date(), key = dayKey(now), wait = sleep, deadline = Infinity) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (attempt > 0) {
      const ms = Math.random() * backoffMs(attempt - 1);
      if (Date.now() + ms > deadline) return false;
      await wait(ms);
    }
    const { day, etag } = await readDay(key);
    try {
      await put(dayPath(key), JSON.stringify(addEvents(day, events)), {
        access: 'private',
        contentType: 'application/json',
        ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }),
      });
      return true;
    } catch (err) {
      const clash = err instanceof BlobPreconditionFailedError || /already exists/i.test(String((err as Error).message));
      if (!clash) throw err;
    }
  }
  return false;
}

/**
 * Events by the day they count on: today, except a listen correction, which
 * goes to the day its first listen was counted (so a visit counts once), if
 * that was today or yesterday. Older corrections are dropped.
 */
export function byDay(events: StatEvent[], now = new Date()): Map<string, StatEvent[]> {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const out = new Map<string, StatEvent[]>();
  for (const e of events) {
    let key = today;
    if (e.t === 'listen' && e.w) {
      const d = e.d ?? today;
      if (d !== today && d !== yesterday) continue;
      key = d;
    }
    const list = out.get(key);
    if (list) list.push(e);
    else out.set(key, [e]);
  }
  return out;
}

export async function handleStats(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const limited = statsRateLimit(request);
  if (limited) return limited;
  const body = await readJson(request, 8_000);
  if (body instanceof Response) return body;
  if (!hasBlobStore()) return noContent();
  const content = await getContent();
  const events = cleanEvents((body as { events?: unknown } | null)?.events, {
    placeIds: new Set(content.places.map(p => p.id)),
    routeIds: new Set(content.routes.map(r => r.id)),
  });
  if (events.length === 0) return noContent();
  const deadline = Date.now() + STATS_DEADLINE_MS;
  // Today's batch first (the newest day sorts first), so the deadline never costs it to a correction for yesterday.
  const batches = [...byDay(events)].sort(([a], [b]) => b.localeCompare(a));
  for (const [key, group] of batches) {
    // Past the deadline, a later batch isn't started at all. (A Blob read or write
    // already under way isn't cut short: aborting a conditional write that may have
    // landed could count its events twice on the retry. The deadline leaves most of
    // the function's time limit for it.)
    if (Date.now() > deadline) {
      console.warn(`Stats: dropped ${group.length} event(s) for ${key}: no time left after the other day's batch.`);
      continue;
    }
    try {
      // Still clashing at the last try or the deadline: say so in the runtime logs rather than lose the counts silently.
      if (!(await recordEvents(group, new Date(), key, sleep, deadline))) console.warn(`Stats: dropped ${group.length} event(s) for ${key}: still clashing after retries (too many at once).`);
    } catch (err) {
      // Stats are best-effort: never show visitors an error for them. Another day's batch still goes ahead.
      console.warn('Recording stats failed:', err);
    }
  }
  return noContent();
}

/** Totals for the last `days` days (today included), and the totals per day. */
export async function readStats(days: number, now = new Date()): Promise<{ total: DayStats; perDay: { date: string; plays: number; routes: number; arrivals: number }[] }> {
  const since = dayKey(new Date(now.getTime() - (days - 1) * 86_400_000));
  if (!hasBlobStore()) return { total: emptyDay(), perDay: [] };
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const key = b.pathname.slice(PREFIX.length, -'.json'.length);
      if (key >= since) keys.push(key);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  keys.sort();
  const loaded = await Promise.all(keys.map(async key => ({ key, day: (await readDay(key)).day })));
  const count = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  return {
    total: sumDays(loaded.map(l => l.day)),
    perDay: loaded.map(({ key, day }) => ({ date: key, plays: count(day.plays), routes: count(day.routes), arrivals: count(day.arrivals) })),
  };
}
