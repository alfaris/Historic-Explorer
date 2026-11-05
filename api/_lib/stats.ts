// Anonymous usage counts (see src/lib/stats.ts): one small JSON file of totals
// per day in Blob, at stats/days/YYYY-MM-DD.json.
//
//   POST /api/stats {events}   → 204   (from the app, batched per visit)
//   readStats(days)            → totals for the admin's Stats tab
//
// Nothing about the visitor is stored. Their IP is only used, in memory, by
// the rate limit.

import { BlobNotFoundError, BlobPreconditionFailedError, get, list, put } from '@vercel/blob';
import { addEvents, cleanEvents, dayKey, emptyDay, parseDay, sumDays, type DayStats } from '../../src/lib/stats.js';
import { getContent } from './content.js';
import { createRateLimiter } from './guard.js';
import { hasBlobStore, json, readJson } from './http.js';

const PREFIX = 'stats/days/';
const dayPath = (key: string) => `${PREFIX}${key}.json`;

// A visit sends one batch every so often; this is plenty for real use.
export const statsRateLimit = createRateLimiter(20, 60_000);

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

/**
 * Adds events to today's totals. Uses the file's ETag so two requests at the
 * same moment can't overwrite each other's counts; on a clash it re-reads and
 * tries again.
 */
export async function recordEvents(events: Parameters<typeof addEvents>[1], now = new Date()) {
  const key = dayKey(now);
  for (let attempt = 0; attempt < 5; attempt++) {
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
  try {
    await recordEvents(events);
  } catch (err) {
    // Stats are best-effort: never show visitors an error for them.
    console.warn('Recording stats failed:', err);
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
