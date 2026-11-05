// The daily report email, against an in-memory Blob and a fake Resend.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async put(pathname: string, body: string) {
      store.set(pathname, body);
      return { pathname, etag: 'e' };
    },
    async get(pathname: string) {
      const b = store.get(pathname);
      return b === undefined ? null : { statusCode: 200, stream: new Response(b).body, blob: { etag: 'e', pathname } };
    },
    async list({ prefix = '' }: { prefix?: string } = {}) {
      return { blobs: [...store.keys()].filter(p => p.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false };
    },
    async del(p: string) {
      store.delete(p);
    },
    async head() {
      throw new BlobNotFoundError('nf');
    },
  };
});

const { handleDigest, runDigest, buildDigest } = await import('./digest');

let emails: { to: string[]; subject: string; text: string; html: string }[];
let resendStatus: number;

// Writes a report file the way the report endpoint stores them.
const addReport = (createdAt: string, extra: Record<string, unknown> = {}, status = 'open') => {
  const id = Math.random().toString(36).slice(2);
  store.set(
    `reports/${status}/${createdAt.replace(/[:.]/g, '-')}_${id}.json`,
    JSON.stringify({ id, createdAt, status, type: 'text', placeId: 1, placeName: 'Ahmad Ibn Tulun Mosque', message: 'Opening hours changed', lang: 'en', ...extra }),
  );
};

beforeEach(() => {
  store.clear();
  emails = [];
  resendStatus = 200;
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
  process.env.RESEND_API_KEY = 're_test';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.CRON_SECRET = 'cron-secret-value';
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    if (resendStatus !== 200) return new Response(JSON.stringify({ message: 'Invalid API key' }), { status: resendStatus });
    emails.push(JSON.parse(init.body as string));
    return new Response('{"id":"1"}');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_EMAIL;
  delete process.env.CRON_SECRET;
});

const NOW = new Date('2026-11-06T06:00:00Z');

describe('runDigest', () => {
  it('emails the open reports from the last day the first time', async () => {
    addReport('2026-11-05T10:00:00.000Z');
    addReport('2026-11-05T12:00:00.000Z', { type: 'location', suggested: { lat: 30.03, lng: 31.25, source: 'gps' }, message: '' });
    addReport('2026-11-01T10:00:00.000Z'); // older than a day
    addReport('2026-11-05T11:00:00.000Z', {}, 'resolved'); // not open
    expect(await runDigest('https://cairo.example', NOW)).toEqual({ sent: 2 });
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toEqual(['admin@example.com']);
    expect(emails[0].subject).toBe('Cairo Walks: 2 new visitor reports');
    expect(emails[0].text).toContain('Wrong location: Ahmad Ibn Tulun Mosque');
    expect(emails[0].text).toContain('Suggested position: 30.03, 31.25');
    expect(emails[0].text).toContain('https://cairo.example/admin');
  });

  it('never emails a report twice, and picks up ones that arrive later', async () => {
    addReport('2026-11-05T10:00:00.000Z');
    await runDigest('https://cairo.example', NOW);
    expect(await runDigest('https://cairo.example', new Date('2026-11-07T06:00:00Z'))).toEqual({ skipped: 'No new reports' });
    addReport('2026-11-06T09:00:00.000Z');
    expect(await runDigest('https://cairo.example', new Date('2026-11-07T06:00:00Z'))).toEqual({ sent: 1 });
    expect(emails).toHaveLength(2);
  });

  it('sends nothing on a day with no new reports', async () => {
    expect(await runDigest('https://cairo.example', NOW)).toEqual({ skipped: 'No new reports' });
    expect(emails).toEqual([]);
  });

  it('is off until Resend and the admin email are set', async () => {
    delete process.env.RESEND_API_KEY;
    addReport('2026-11-05T10:00:00.000Z');
    expect(await runDigest('https://cairo.example', NOW)).toEqual({ skipped: 'RESEND_API_KEY and ADMIN_EMAIL are not set' });
  });

  it('keeps the reports for next time when sending fails', async () => {
    addReport('2026-11-05T10:00:00.000Z');
    resendStatus = 401;
    await expect(runDigest('https://cairo.example', NOW)).rejects.toThrow(/Invalid API key/);
    resendStatus = 200;
    expect(await runDigest('https://cairo.example', NOW)).toEqual({ sent: 1 });
  });

  it('sends to several addresses', async () => {
    process.env.ADMIN_EMAIL = 'a@example.com, b@example.com';
    addReport('2026-11-05T10:00:00.000Z');
    await runDigest('https://cairo.example', NOW);
    expect(emails[0].to).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('buildDigest', () => {
  it('escapes visitor text in the HTML', () => {
    const { html, text } = buildDigest(
      [{ id: 'x', createdAt: '', status: 'open', type: 'text', placeId: 1, placeName: 'A <b>place</b>', message: '<script>alert(1)</script>', lang: 'en' }],
      3,
      'https://cairo.example/admin',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &lt;b&gt;place&lt;/b&gt;');
    expect(text).toContain('…and 2 more.');
  });
});

describe('GET /api/digest', () => {
  const call = (auth?: string) =>
    handleDigest(new Request('https://cairo.example/api/digest', { headers: auth ? { authorization: auth } : {} }));

  it('only runs for Vercel Cron (the CRON_SECRET bearer token)', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect((await call('Bearer cron-secret-value')).status).toBe(200);
  });

  it('is closed when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer ')).status).toBe(401);
  });
});
