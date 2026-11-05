// Request checks that run before any Gemini work, so the API can't be used to
// run up the Gemini bill.

type Lang = 'en' | 'ar';

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

/**
 * Accepts only the exact query the app sends (`?id=<n>&lang=en|ar`). Anything
 * else is rejected, so extra or odd parameters can't create new CDN cache keys
 * that skip the cache and reach Gemini.
 */
export const parseCanonicalQuery = (url: URL): { id: number; lang: Lang } | Response => {
  const keys = [...url.searchParams.keys()];
  const id = url.searchParams.get('id') ?? '';
  const lang = url.searchParams.get('lang') ?? '';
  const valid =
    keys.length === 2 &&
    new Set(keys).size === 2 &&
    /^[1-9]\d{0,5}$/.test(id) &&
    (lang === 'en' || lang === 'ar');
  if (!valid) return json({ error: 'Expected ?id=<number>&lang=en|ar' }, 400);
  return { id: Number(id), lang };
};

// Per-IP fixed-window limit. Counts are kept per function instance, so this is
// a backstop rather than an exact global limit. CDN cache hits never reach the
// function, so ordinary browsing rarely counts against it.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

const clientIp = (request: Request) =>
  request.headers.get('x-real-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  'unknown';

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export const rateLimit = (request: Request, now = Date.now()): Response | null => {
  if (hits.size > 10_000) {
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }

  const ip = clientIp(request);
  let entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count <= MAX_REQUESTS_PER_WINDOW) return null;

  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return json({ error: 'Too many requests, please try again in a minute.' }, 429, {
    'Retry-After': String(retryAfter),
  });
};
