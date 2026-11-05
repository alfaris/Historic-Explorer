import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkPassword, createSessionToken, requireAdmin, verifySessionToken } from './admin-auth';
import { buildReport } from './reports';
import { handleAdmin } from './admin';

const PASSWORD = 'correct horse battery staple';

beforeEach(() => {
  process.env.ADMIN_PASSWORD = PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

const req = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`https://cairo.example${path}`, {
    ...init,
    headers: { ...(init.cookie ? { cookie: `cw_admin=${init.cookie}` } : {}), ...(init.headers as Record<string, string>) },
  });

describe('admin auth', () => {
  it('checks the password', () => {
    expect(checkPassword(PASSWORD)).toBe(true);
    expect(checkPassword('wrong')).toBe(false);
    expect(checkPassword('')).toBe(false);
  });

  it('is disabled when the password is missing or too short', () => {
    process.env.ADMIN_PASSWORD = 'short';
    expect(checkPassword('short')).toBe(false);
    expect(verifySessionToken(createSessionToken())).toBe(false);
  });

  it('accepts its own session tokens until they expire', () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    expect(verifySessionToken(token, now + 13 * 3600_000)).toBe(false);
  });

  it('rejects tampered or foreign tokens', () => {
    const token = createSessionToken();
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString('base64url');
    expect(verifySessionToken(`${forged}.${sig}`)).toBe(false);
    expect(verifySessionToken(`${payload}.${sig.slice(0, -2)}xx`)).toBe(false);
    expect(verifySessionToken('garbage')).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });

  it('signs everyone out when the password changes, even with a custom session secret', () => {
    process.env.ADMIN_SESSION_SECRET = 'a long random secret value';
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
    process.env.ADMIN_PASSWORD = 'a completely different password';
    expect(verifySessionToken(token)).toBe(false);
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it('signs everyone out when the password changes', () => {
    const token = createSessionToken();
    process.env.ADMIN_PASSWORD = 'a completely different password';
    expect(verifySessionToken(token)).toBe(false);
  });

  it('requires a session, and the admin header for changes', () => {
    const token = createSessionToken();
    expect(requireAdmin(req('/api/admin?action=content'))?.status).toBe(401);
    expect(requireAdmin(req('/api/admin?action=content', { cookie: token }))).toBeNull();
    expect(requireAdmin(req('/api/admin?action=content', { method: 'PUT', cookie: token }))?.status).toBe(403);
    expect(requireAdmin(req('/api/admin?action=content', { method: 'PUT', cookie: token, headers: { 'x-cairo-walks-admin': '1' } }))).toBeNull();
  });
});

describe('admin endpoint', () => {
  it('logs in with the right password and sets a session cookie', async () => {
    const bad = await handleAdmin(req('/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'nope' }) }));
    expect(bad.status).toBe(401);
    const good = await handleAdmin(req('/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: PASSWORD }), headers: { 'x-real-ip': '9.9.9.9' } }));
    expect(good.status).toBe(200);
    const cookie = good.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^cw_admin=[^;]+; HttpOnly; SameSite=Strict; Path=\/api\/admin/);
    expect(cookie).toMatch(/Secure/);
  });

  it('refuses admin actions without a session', async () => {
    const res = await handleAdmin(req('/api/admin?action=reports'));
    expect(res.status).toBe(401);
  });

  it('rejects invalid content before saving', async () => {
    const res = await handleAdmin(
      req('/api/admin?action=content', {
        method: 'PUT',
        cookie: createSessionToken(),
        headers: { 'x-cairo-walks-admin': '1' },
        body: JSON.stringify({ content: { routes: [], places: [] }, etag: null }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).problems.join(' ')).toMatch(/at least one route/);
  });

  it('rate-limits login attempts', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const r = await handleAdmin(req('/api/admin?action=login', { method: 'POST', body: '{"password":"x"}', headers: { 'x-real-ip': '7.7.7.7' } }));
      last = r.status;
    }
    expect(last).toBe(429);
  });
});

describe('buildReport', () => {
  it('builds a location report with a rounded suggested position', async () => {
    const r = await buildReport({ type: 'location', placeId: 1, suggested: { lat: 30.02871234567, lng: 31.250241111, source: 'gps', accuracy: 7.6 }, lang: 'ar' });
    expect(typeof r).toBe('object');
    if (typeof r === 'string') return;
    expect(r).toMatchObject({ type: 'location', placeId: 1, placeName: 'Ahmad Ibn Tulun Mosque', status: 'open', lang: 'ar' });
    expect(r.suggested).toEqual({ lat: 30.028712, lng: 31.250241, source: 'gps', accuracy: 8 });
  });

  it.each([
    [{ type: 'spam', placeId: 1 }, /Unknown report type/],
    [{ type: 'closed', placeId: 99999 }, /Unknown place/],
    [{ type: 'text', placeId: 1, message: '' }, /describe/],
    [{ type: 'location', placeId: 1, suggested: { lat: 48.85, lng: 2.35 } }, /in Cairo/],
    [{ type: 'location', placeId: 1 }, /in Cairo/],
  ])('rejects %j', async (input, message) => {
    const r = await buildReport(input);
    expect(typeof r).toBe('string');
    expect(r).toMatch(message);
  });

  it('trims long messages and ignores extra fields', async () => {
    const r = await buildReport({ type: 'photo', placeId: 3, message: 'x'.repeat(5000), ip: '1.2.3.4', email: 'a@b.c' });
    if (typeof r === 'string') throw new Error(r);
    expect(r.message.length).toBe(1000);
    expect(r).not.toHaveProperty('ip');
    expect(r).not.toHaveProperty('email');
  });
});
