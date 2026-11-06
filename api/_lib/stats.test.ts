// The stats endpoint against an in-memory stand-in for Vercel Blob with
// ETags and conditional writes (like store.test.ts).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { body: string; etag: string }>();
let etagCounter = 0;

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async put(pathname: string, body: string, opts: { ifMatch?: string; allowOverwrite?: boolean } = {}) {
      await new Promise(r => setTimeout(r, Math.random() * 5)); // let requests overlap
      const existing = store.get(pathname);
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError('precondition failed');
      if (existing && opts.ifMatch === undefined && !opts.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      const etag = `"e${++etagCounter}"`;
      store.set(pathname, { body, etag });
      return { pathname, etag };
    },
    async get(pathname: string) {
      const b = store.get(pathname);
      if (!b) return null;
      return { statusCode: 200, stream: new Response(b.body).body, blob: { etag: b.etag, pathname } };
    },
    async list({ prefix = '' }: { prefix?: string } = {}) {
      return { blobs: [...store.keys()].filter(p => p.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false };
    },
    async head() {
      throw new BlobNotFoundError('not found');
    },
  };
});

const { handleStats, readStats, recordEvents } = await import('./stats');
const { _resetContentCache } = await import('./content');

let ip = 0;
const send = (body: unknown, raw = false) =>
  handleStats(new Request('https://x/api/stats', { method: 'POST', body: raw ? (body as string) : JSON.stringify(body), headers: { 'x-real-ip': `10.9.0.${++ip % 250}` } }));

beforeEach(() => {
  store.clear();
  _resetContentCache();
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
});

describe('POST /api/stats', () => {
  it('adds valid events to today’s totals and ignores the rest', async () => {
    const res = await send({ events: [{ t: 'play', id: 1 }, { t: 'route', id: 'ahl-al-bayt' }, { t: 'play', id: 999999 }, { t: 'route', id: 'x' }] });
    expect(res.status).toBe(204);
    const { total } = await readStats(7);
    expect(total).toEqual({ plays: { 1: 1 }, routes: { 'ahl-al-bayt': 1 }, arrivals: {}, helpful: {}, unhelpful: {} });
  });

  it('stores nothing about the visitor', async () => {
    await send({ events: [{ t: 'arrive', id: 1 }], ip: '1.2.3.4', ua: 'x' });
    const stored = [...store.values()].map(b => b.body).join('');
    expect(stored).not.toMatch(/1\.2\.3\.4|10\.9\.0|ua/);
  });

  it('accepts empty or broken bodies quietly', async () => {
    expect((await send({})).status).toBe(204);
    expect((await send({ events: 'nope' })).status).toBe(204);
    expect(store.size).toBe(0);
  });

  it('does nothing without a Blob store', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await send({ events: [{ t: 'play', id: 1 }] })).status).toBe(204);
    expect(store.size).toBe(0);
  });

  it('rate-limits a single IP', async () => {
    let last = 0;
    for (let i = 0; i < 22; i++) {
      last = (await handleStats(new Request('https://x/api/stats', { method: 'POST', body: '{"events":[]}', headers: { 'x-real-ip': '7.7.7.7' } }))).status;
    }
    expect(last).toBe(429);
  });
});

describe('recordEvents', () => {
  it('keeps every count when requests arrive at the same moment', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => recordEvents([{ t: 'play', id: 1 }])));
    expect(results.every(Boolean)).toBe(true);
    expect((await readStats(1)).total.plays[1]).toBe(4);
  });
});

describe('readStats', () => {
  it('adds up the days in the period and leaves older days out', async () => {
    const now = new Date('2026-11-05T12:00:00Z');
    await recordEvents([{ t: 'play', id: 1 }], now);
    await recordEvents([{ t: 'play', id: 1 }, { t: 'arrive', id: 2 }], new Date('2026-11-01T12:00:00Z'));
    await recordEvents([{ t: 'play', id: 1 }], new Date('2026-10-01T12:00:00Z')); // outside 7 days
    const week = await readStats(7, now);
    expect(week.total.plays[1]).toBe(2);
    expect(week.perDay).toEqual([
      { date: '2026-11-01', plays: 1, routes: 0, arrivals: 1 },
      { date: '2026-11-05', plays: 1, routes: 0, arrivals: 0 },
    ]);
    expect((await readStats(90, now)).total.plays[1]).toBe(3);
  });
});
