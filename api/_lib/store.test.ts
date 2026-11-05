// End-to-end tests of the admin and report endpoints against an in-memory
// stand-in for Vercel Blob that behaves like the real one for what we use:
// ETags, conditional writes (ifMatch / allowOverwrite), get, list and head.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { body: string; etag: string; uploadedAt: Date }>();
let etagCounter = 0;

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async put(pathname: string, body: string, opts: { ifMatch?: string; allowOverwrite?: boolean } = {}) {
      const existing = store.get(pathname);
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError('precondition failed');
      if (existing && opts.ifMatch === undefined && !opts.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      const etag = `"e${++etagCounter}"`;
      store.set(pathname, { body: String(body), etag, uploadedAt: new Date(Date.now() + etagCounter) });
      return { pathname, etag, url: `https://x/${pathname}` };
    },
    async get(pathname: string) {
      const b = store.get(pathname);
      if (!b) return null;
      return { statusCode: 200, stream: new Response(b.body).body, blob: { etag: b.etag, pathname } };
    },
    async head(pathname: string) {
      if (!store.has(pathname)) throw new BlobNotFoundError('not found');
      return { pathname };
    },
    async list({ prefix = '' }: { prefix?: string } = {}) {
      const blobs = [...store.entries()]
        .filter(([p]) => p.startsWith(prefix))
        .map(([pathname, b]) => ({ pathname, size: b.body.length, uploadedAt: b.uploadedAt, etag: b.etag }));
      return { blobs, hasMore: false };
    },
  };
});

const { handleAdmin } = await import('./admin');
const { handleReport } = await import('./reports');
const { _resetContentCache, getContent } = await import('./content');
const { createSessionToken } = await import('./admin-auth');
const { bundledContent } = await import('../../src/data/content');

let ip = 0;
const admin = (action: string, init: RequestInit = {}, query = '') =>
  handleAdmin(
    new Request(`https://cairo.example/api/admin?action=${action}${query}`, {
      ...init,
      headers: { cookie: `cw_admin=${createSessionToken()}`, 'x-cairo-walks-admin': '1', 'x-real-ip': `10.0.0.${++ip % 250}` },
    }),
  );
const report = (body: unknown) =>
  handleReport(new Request('https://cairo.example/api/report', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': `10.1.0.${++ip % 250}` } }));

beforeEach(() => {
  store.clear();
  _resetContentCache();
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
  process.env.ADMIN_PASSWORD = 'correct horse battery staple';
});

describe('content', () => {
  it('serves the bundled content until the first save', async () => {
    const res = await admin('content');
    const data = await res.json();
    expect(data.etag).toBeNull();
    expect(data.content.places.length).toBe(bundledContent.places.length);
  });

  it('saves, serves the saved copy, and keeps history', async () => {
    const { content } = await (await admin('content')).json();
    content.places[0].nameEn = 'Ibn Tulun (edited)';
    const saved = await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: null, note: 'rename' }) });
    expect(saved.status).toBe(200);
    _resetContentCache();
    expect((await getContent()).places[0].nameEn).toBe('Ibn Tulun (edited)');
    const { history } = await (await admin('history')).json();
    expect(history).toHaveLength(1);
  });

  it('refuses a save based on an outdated copy (two admins)', async () => {
    const { content } = await (await admin('content')).json();
    const first = await (await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: null, note: 'a' }) })).json();
    // Admin B still holds the "nothing saved yet" view.
    const stale = await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: null, note: 'b' }) });
    expect(stale.status).toBe(409);
    // With the current ETag it works.
    const fresh = await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: first.etag, note: 'c' }) });
    expect(fresh.status).toBe(200);
    const outdated = await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: first.etag, note: 'd' }) });
    expect(outdated.status).toBe(409);
  });

  it('restores an old version from history', async () => {
    let { content, etag } = await (await admin('content')).json();
    const original = content.places[0].nameEn;
    ({ etag } = await (await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag, note: 'v1' }) })).json());
    content.places[0].nameEn = 'Changed';
    ({ etag } = await (await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag, note: 'v2' }) })).json());
    const { history } = await (await admin('history')).json();
    const oldest = history[history.length - 1];
    const { content: v1 } = await (await admin('version', {}, `&pathname=${encodeURIComponent(oldest.pathname)}`)).json();
    expect(v1.places[0].nameEn).toBe(original);
    expect((await admin('version', {}, '&pathname=reports/../secret')).status).toBe(404);
  });

  it('serves bundled content if the stored copy is broken', async () => {
    store.set('content/current.json', { body: '{"routes":[],"places":[]}', etag: '"x"', uploadedAt: new Date() });
    expect((await getContent()).places.length).toBe(bundledContent.places.length);
  });

  it('places added by an admin can be reported', async () => {
    const { content, etag } = await (await admin('content')).json();
    content.places.push({ ...content.places[0], id: 9000, nameEn: 'New Cafe', lat: 30.03, lng: 31.251 });
    await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag, note: 'add' }) });
    _resetContentCache();
    expect((await report({ type: 'closed', placeId: 9000 })).status).toBe(201);
  });
});

describe('reports', () => {
  it('stores a report and lists it for the admin', async () => {
    const res = await report({ type: 'location', placeId: 35, suggested: { lat: 30.0225, lng: 31.2514, source: 'map' }, message: 'It is across the road' });
    expect(res.status).toBe(201);
    const { reports } = await (await admin('reports')).json();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ type: 'location', placeId: 35, status: 'open', placeName: 'Sayyida Nafisa Square' });
  });

  it('updates a report’s status', async () => {
    await report({ type: 'photo', placeId: 3, message: 'Photo shows the wrong building' });
    const { reports } = await (await admin('reports')).json();
    const res = await admin('report', { method: 'PATCH', body: JSON.stringify({ id: reports[0].id, status: 'resolved' }) });
    expect((await res.json()).report.status).toBe('resolved');
    const after = (await (await admin('reports')).json()).reports;
    expect(after[0].status).toBe('resolved');
  });

  it('silently drops honeypot submissions', async () => {
    const res = await report({ type: 'closed', placeId: 1, website: 'http://spam' });
    expect(res.status).toBe(200);
    expect((await (await admin('reports')).json()).reports).toHaveLength(0);
  });

  it('rate-limits one visitor', async () => {
    const send = () =>
      handleReport(new Request('https://cairo.example/api/report', { method: 'POST', body: '{"type":"closed","placeId":1}', headers: { 'x-real-ip': '1.2.3.4' } }));
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await send()).status);
    expect(statuses.slice(0, 5).every(s => s === 201)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it('refuses oversized bodies', async () => {
    const res = await report({ type: 'text', placeId: 1, message: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });
});
