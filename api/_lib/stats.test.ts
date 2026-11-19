// The stats endpoint against an in-memory stand-in for Vercel Blob with
// ETags and conditional writes (like store.test.ts).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { body: string; etag: string }>();
let etagCounter = 0;
// Conditional writes to refuse next, as if another request had just written.
const clash = { next: 0 };
// Called after each write that lands (a test can move the clock on).
const hooks = { afterPut: () => {} };

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async put(pathname: string, body: string, opts: { ifMatch?: string; allowOverwrite?: boolean } = {}) {
      await new Promise(r => setTimeout(r, Math.random() * 5)); // let requests overlap
      const existing = store.get(pathname);
      if (clash.next > 0) {
        clash.next--;
        throw new BlobPreconditionFailedError('precondition failed');
      }
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError('precondition failed');
      if (existing && opts.ifMatch === undefined && !opts.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      const etag = `"e${++etagCounter}"`;
      store.set(pathname, { body, etag });
      hooks.afterPut();
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

const { MAX_TRIES, STATS_PER_MINUTE, backoffMs, byDay, handleStats, readStats, recordEvents, statsRateLimit } = await import('./stats');
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
    expect(total).toEqual({ plays: { 1: 1 }, routes: { 'ahl-al-bayt': 1 }, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {}, langs: {}, listens: {}, misses: {}, quiz: {}, clients: {} });
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

  it('lets a tour group on one address through: 30 phones sending every 30 s', async () => {
    const t0 = Date.now() + 10 * 60_000; // a fresh window for this address
    const req = () => new Request('https://x/api/stats', { method: 'POST', body: '{"events":[]}', headers: { 'x-real-ip': '8.8.8.8' } });
    for (let round = 0; round < 4; round++) {
      for (let phone = 0; phone < 30; phone++) expect(statsRateLimit(req(), t0 + round * 30_000 + phone * 100)).toBeNull();
    }
  });

  it('still refuses a flood from one address, and logs it once a minute', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const t0 = Date.now() + 20 * 60_000;
      const req = () => new Request('https://x/api/stats', { method: 'POST', body: '{"events":[]}', headers: { 'x-real-ip': '7.7.7.7' } });
      const statuses = Array.from({ length: STATS_PER_MINUTE + 30 }, (_, i) => statsRateLimit(req(), t0 + i)?.status ?? 200);
      expect(statuses.slice(0, STATS_PER_MINUTE).every(s => s === 200)).toBe(true);
      expect(statuses.slice(STATS_PER_MINUTE).every(s => s === 429)).toBe(true);
      expect(warn.mock.calls.filter(([m]) => /refusing requests from one address/.test(String(m)))).toHaveLength(1);
      expect(String(warn.mock.calls[0][0])).not.toContain('7.7.7.7');
      // Through the endpoint too.
      expect((await handleStats(req())).status).toBe(429);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('where events come from', () => {
  it('counts events by client and app build, and the web says it is the web', async () => {
    expect((await send({ events: [{ t: 'play', id: 201 }, { t: 'play', id: 201 }], client: 'android', appVersion: 3 })).status).toBe(204);
    expect((await send({ events: [{ t: 'play', id: 201 }] })).status).toBe(204);
    const { total } = await readStats(1);
    expect(total.clients).toEqual({ android: 2, 'android:3': 2 });
    expect(total.plays[201]).toBe(3);
  });
});

describe('recordEvents', () => {
  const noWait = async () => {};
  it('waits and tries again after a clash', async () => {
    clash.next = 5;
    const waits: number[] = [];
    expect(await recordEvents([{ t: 'play', id: 1 }], new Date(), undefined, async ms => void waits.push(ms))).toBe(true);
    expect(waits).toHaveLength(5);
    waits.forEach((ms, i) => expect(ms).toBeLessThanOrEqual(backoffMs(i)));
    expect((await readStats(1)).total.plays[1]).toBe(1);
  });
  it('gives up after the last try, and the endpoint logs the dropped batch', async () => {
    clash.next = MAX_TRIES;
    expect(await recordEvents([{ t: 'play', id: 1 }], new Date(), undefined, noWait)).toBe(false);
    clash.next = 1000;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const res = send({ events: [{ t: 'play', id: 201 }, { t: 'play', id: 201 }] });
      await vi.runAllTimersAsync();
      expect((await res).status).toBe(204);
    } finally {
      vi.useRealTimers();
      clash.next = 0;
    }
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/dropped 2 event\(s\) for .*still clashing/));
    warn.mockRestore();
  });
  it('stops retrying at the deadline', async () => {
    clash.next = MAX_TRIES;
    let waited = 0;
    const ok = await recordEvents([{ t: 'play', id: 1 }], new Date(), undefined, async () => void waited++, Date.now() - 1);
    expect(ok).toBe(false);
    expect(waited).toBe(0); // one try, no wait past the deadline
    clash.next = 0;
  });
  it("doesn't start another day's batch past the deadline, and logs it", async () => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    hooks.afterPut = () => {
      offset = 60_000; // the first batch took far too long
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const days = byDay([{ t: 'play', id: 201 }, { t: 'listen', id: 201, b: 'done', w: 'q1', d: yesterday }]);
      expect([...days.keys()].sort()).toEqual([yesterday, today].sort());
      // Yesterday's correction comes first in the batch, but today's events are recorded first.
      expect((await send({ events: [{ t: 'listen', id: 201, b: 'done', w: 'q1', d: yesterday }, { t: 'play', id: 201 }] })).status).toBe(204);
      expect(warn).toHaveBeenCalledWith(`Stats: dropped 1 event(s) for ${yesterday}: no time left after the other day's batch.`);
      expect([...store.keys()]).toEqual([`stats/days/${today}.json`]); // only today's file was written
    } finally {
      hooks.afterPut = () => {};
      now.mockRestore();
      warn.mockRestore();
    }
  });
  it('keeps the total wait bounded', () => {
    const total = Array.from({ length: MAX_TRIES - 1 }, (_, i) => backoffMs(i)).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(3_500);
  });
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

describe('byDay', () => {
  const now = new Date('2026-11-16T00:10:00Z');
  it("counts a listen correction on the day its first listen was counted, if that was today or yesterday", () => {
    const days = byDay([
      { t: 'play', id: 1 },
      { t: 'listen', id: 1, b: 'done', w: 'q1', d: '2026-11-15' },
      { t: 'listen', id: 2, b: 'q3', w: 'q1' },
      { t: 'listen', id: 3, b: 'done', w: 'q2', d: '2026-11-10' },
    ], now);
    expect([...days.entries()]).toEqual([
      ['2026-11-16', [{ t: 'play', id: 1 }, { t: 'listen', id: 2, b: 'q3', w: 'q1' }]],
      ['2026-11-15', [{ t: 'listen', id: 1, b: 'done', w: 'q1', d: '2026-11-15' }]],
    ]);
  });

  it('moves the count within that day when the correction arrives after midnight', async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    await recordEvents([{ t: 'listen', id: 1, b: 'q1' }, { t: 'listen', id: 2, b: 'q1' }], yesterday);
    // Another visitor today, in the band being corrected: untouched.
    await recordEvents([{ t: 'listen', id: 1, b: 'q1' }]);
    await send({ events: [{ t: 'listen', id: 1, b: 'done', w: 'q1', d: yesterday.toISOString().slice(0, 10) }] });
    const { total } = await readStats(7);
    expect(total.listens).toEqual({ '1:q1': 1, '1:done': 1, '2:q1': 1 });
  });
});
