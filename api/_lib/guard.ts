// Request checks that run before any Gemini work, so the API can't be used to
// run up the Gemini bill.

import { isLang, LANGS, type Lang } from '../../src/i18n/lang.js';

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

/**
 * Accepts only the exact query the app sends (`?id=<n>&lang=en|ar|fr|es`). Anything
 * else is rejected, so extra or odd parameters can't create new CDN cache keys
 * that skip the cache and reach Gemini.
 */
export const parseCanonicalQuery = (
  url: URL,
  { allowVersion = false } = {},
): { id: number; lang: Lang; version: string | null } | Response => {
  const keys = [...url.searchParams.keys()];
  const id = url.searchParams.get('id') ?? '';
  const lang = url.searchParams.get('lang') ?? '';
  const version = url.searchParams.get('v');
  const expected = allowVersion && version !== null ? 3 : 2;
  const valid =
    keys.length === expected &&
    new Set(keys).size === expected &&
    /^[1-9]\d{0,5}$/.test(id) &&
    isLang(lang) &&
    (version === null || (allowVersion && /^[0-9a-f]{8}$/.test(version)));
  if (!valid) return json({ error: `Expected ?id=<number>&lang=${LANGS.join('|')}${allowVersion ? '[&v=<hash>]' : ''}` }, 400);
  return { id: Number(id), lang, version };
};

// Per-IP fixed-window limits. Counts are kept per function instance, so this
// is a backstop rather than an exact global limit. CDN cache hits never reach
// the function, so ordinary browsing rarely counts against it.
const clientIp = (request: Request) =>
  request.headers.get('x-real-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  'unknown';

/**
 * Makes a limiter allowing `max` requests per IP per `windowMs`. The limiter
 * returns a 429 response when the caller is over the limit, otherwise null.
 */
export function createRateLimiter(max: number, windowMs: number, message = 'Too many requests, please try again in a minute.') {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, now = Date.now()): Response | null => {
    if (hits.size > 10_000) {
      for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
    }
    const ip = clientIp(request);
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count <= max) return null;
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return json({ error: message }, 429, { 'Retry-After': String(retryAfter) });
  };
}

/** The general API limit: 40 requests per minute per IP. */
export const rateLimit = createRateLimiter(40, 60_000);
