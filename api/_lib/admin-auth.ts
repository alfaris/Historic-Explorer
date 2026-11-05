// Admin login: one password, set as ADMIN_PASSWORD in the environment, and a
// signed session cookie. Nothing about the password is ever sent to the browser.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createRateLimiter } from './guard.js';
import { json } from './http.js';

const COOKIE = 'cw_admin';
const SESSION_SECONDS = 12 * 60 * 60;
/** Header every state-changing admin request must carry. Browsers won't send a
 * custom header cross-site without a CORS preflight, which this API never
 * approves, so other sites can't make an admin's browser act for them. */
export const ADMIN_HEADER = 'x-cairo-walks-admin';

// 10 login attempts per IP per 15 minutes.
export const loginRateLimit = createRateLimiter(10, 15 * 60_000, 'Too many login attempts. Try again in 15 minutes.');

const password = () => process.env.ADMIN_PASSWORD ?? '';
export const adminConfigured = () => password().length >= 12;

// Changing the password (or ADMIN_SESSION_SECRET) signs every admin out.
const secret = () => process.env.ADMIN_SESSION_SECRET || createHash('sha256').update(`cairo-walks-admin:${password()}`).digest('hex');

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

const sameString = (a: string, b: string) => {
  // Compare fixed-length digests so the time taken doesn't reveal anything.
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
};

export const checkPassword = (attempt: string) => adminConfigured() && sameString(attempt, password());

export function createSessionToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !adminConfigured()) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !sameString(signature, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp * 1000 > now;
  } catch {
    return false;
  }
}

const readCookie = (request: Request, name: string) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map(c => c.trim().split('='))
    .find(([k]) => k === name)?.[1];

const secureFlag = (request: Request) => (new URL(request.url).protocol === 'https:' ? '; Secure' : '');

export const sessionCookie = (request: Request, token: string) =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}${secureFlag(request)}`;

export const clearSessionCookie = (request: Request) =>
  `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secureFlag(request)}`;

/**
 * Returns an error response unless the request comes from a signed-in admin
 * (and, for anything other than GET, carries the admin header).
 */
export function requireAdmin(request: Request): Response | null {
  if (!adminConfigured()) return json({ error: 'Admin is not set up: ADMIN_PASSWORD (12+ characters) is missing.' }, 503);
  if (request.method !== 'GET' && request.headers.get(ADMIN_HEADER) !== '1') return json({ error: 'Missing admin header.' }, 403);
  if (!verifySessionToken(readCookie(request, COOKIE))) return json({ error: 'Please sign in.' }, 401);
  return null;
}
