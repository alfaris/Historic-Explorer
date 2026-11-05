// End-to-end tests of the admin and report endpoints against an in-memory
// stand-in for Vercel Blob that behaves like the real one for what we use:
// ETags, conditional writes (ifMatch / allowOverwrite), get, list and head.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { body: string | Uint8Array; etag: string; uploadedAt: Date; contentType?: string }>();
let etagCounter = 0;

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    async put(pathname: string, body: string | Uint8Array, opts: { ifMatch?: string; allowOverwrite?: boolean; contentType?: string } = {}) {
      const existing = store.get(pathname);
      if (opts.ifMatch !== undefined && existing?.etag !== opts.ifMatch) throw new BlobPreconditionFailedError('precondition failed');
      if (existing && opts.ifMatch === undefined && !opts.allowOverwrite) throw new Error('Vercel Blob: This blob already exists');
      const etag = `"e${++etagCounter}"`;
      store.set(pathname, { body: typeof body === 'string' ? body : new Uint8Array(body), etag, uploadedAt: new Date(Date.now() + etagCounter), contentType: opts.contentType });
      return { pathname, etag, url: `https://x/${pathname}` };
    },
    async get(pathname: string) {
      const b = store.get(pathname);
      if (!b) return null;
      return { statusCode: 200, stream: new Response(b.body).body, blob: { etag: b.etag, pathname, contentType: b.contentType ?? 'application/octet-stream' } };
    },
    async del(pathname: string | string[]) {
      for (const p of Array.isArray(pathname) ? pathname : [pathname]) store.delete(p);
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
const { handlePhotoServe, sniffImageType } = await import('./photos');

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
    // The built-in baseline plus this save.
    expect(history).toHaveLength(2);
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
    const resolved = (await (await admin('reports', {}, '&status=resolved')).json()).reports;
    expect(resolved[0].status).toBe('resolved');
    expect((await (await admin('reports', {}, '&status=open')).json()).reports).toHaveLength(0);
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

describe('photos', () => {
  // A minimal WebP header followed by some bytes.
  const webp = new Uint8Array([...new TextEncoder().encode('RIFF'), 0x20, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8 '), ...Array(40).fill(7)]);
  const upload = (body: BodyInit, query = '&width=960&height=640', headers: Record<string, string> = {}) =>
    handleAdmin(
      new Request(`https://cairo.example/api/admin?action=photo${query}`, {
        method: 'POST',
        body,
        headers: { cookie: `cw_admin=${createSessionToken()}`, 'x-cairo-walks-admin': '1', ...headers },
      }),
    );

  it('recognises image types by their bytes', () => {
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('uploads a photo, stores it once, and serves it with long caching', async () => {
    const res = await upload(webp);
    expect(res.status).toBe(201);
    const { src, width, height } = await res.json();
    expect(src).toMatch(/^\/api\/photo\?id=[0-9a-f]{64}$/);
    expect([width, height]).toEqual([960, 640]);
    await upload(webp);
    expect([...store.keys()].filter(k => k.startsWith('photos/'))).toHaveLength(1);

    const served = await handlePhotoServe(new Request(`https://cairo.example${src}`));
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(served.headers.get('cache-control')).toMatch(/immutable/);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(webp);
  });

  it('refuses non-images, oversized files and missing sizes', async () => {
    expect((await upload(new TextEncoder().encode('<svg onload=alert(1)>'))).status).toBe(415);
    expect((await upload(new Uint8Array(1_600_000))).status).toBe(413);
    expect((await upload(webp, '&width=0&height=10')).status).toBe(400);
  });

  it('requires a signed-in admin', async () => {
    const res = await handleAdmin(new Request('https://cairo.example/api/admin?action=photo&width=1&height=1', { method: 'POST', body: webp, headers: { 'x-cairo-walks-admin': '1' } }));
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown or malformed IDs', async () => {
    expect((await handlePhotoServe(new Request(`https://cairo.example/api/photo?id=${'b'.repeat(64)}`))).status).toBe(404);
    expect((await handlePhotoServe(new Request('https://cairo.example/api/photo?id=../content/current.json'))).status).toBe(404);
  });
});

describe('review fixes', () => {
  it('keeps the built-in content in history, so the first edit can be undone', async () => {
    const { content } = await (await admin('content')).json();
    const removed = content.places.shift();
    await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag: null, note: 'delete first place' }) });
    const { history } = await (await admin('history')).json();
    expect(history).toHaveLength(2);
    const baseline = history[history.length - 1];
    const { content: original } = await (await admin('version', {}, `&pathname=${encodeURIComponent(baseline.pathname)}`)).json();
    expect(original.places.some((p: { id: number }) => p.id === removed.id)).toBe(true);
  });

  it('never reuses the ID of a deleted place, even if the browser forgets', async () => {
    let { content, etag } = await (await admin('content')).json();
    const top = Math.max(...content.places.map((p: { id: number }) => p.id));
    content.places = content.places.filter((p: { id: number }) => p.id !== top);
    delete content.maxPlaceId;
    ({ etag } = await (await admin('content', { method: 'PUT', body: JSON.stringify({ content, etag, note: 'delete top' }) })).json());
    _resetContentCache();
    const saved = (await (await admin('content')).json()).content;
    expect(saved.maxPlaceId).toBe(top);
  });

  it('files reports by status and pages through them', async () => {
    for (let i = 0; i < 3; i++) await report({ type: 'closed', placeId: 1 + i });
    let page = await (await admin('reports', {}, '&status=open')).json();
    expect(page.total).toBe(3);
    expect(page.counts).toEqual({ open: 3, resolved: 0, dismissed: 0 });
    await admin('report', { method: 'PATCH', body: JSON.stringify({ id: page.reports[0].id, status: 'resolved' }) });
    page = await (await admin('reports', {}, '&status=open')).json();
    expect(page.counts).toEqual({ open: 2, resolved: 1, dismissed: 0 });
    expect([...store.keys()].filter(k => k.startsWith('reports/resolved/'))).toHaveLength(1);
    expect([...store.keys()].filter(k => k.startsWith('reports/open/'))).toHaveLength(2);
    const second = await (await admin('reports', {}, '&status=open&offset=1')).json();
    expect(second.reports).toHaveLength(1);
    expect(second.reports[0].id).toBe(page.reports[1].id);
  });

  it('reaches old open reports beyond the first page', async () => {
    for (let i = 0; i < 55; i++) {
      const r = { id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, createdAt: new Date(2026, 0, 1, 0, i).toISOString(), status: 'open' };
      store.set(`reports/open/${r.createdAt.replace(/[:.]/g, '-')}_${r.id}.json`, { body: JSON.stringify({ ...r, type: 'closed', placeId: 1, placeName: 'x', message: '', lang: 'en' }), etag: 'x', uploadedAt: new Date() });
    }
    const first = await (await admin('reports', {}, '&status=open')).json();
    expect(first.reports).toHaveLength(50);
    expect(first.total).toBe(55);
    const rest = await (await admin('reports', {}, '&status=open&offset=50')).json();
    expect(rest.reports).toHaveLength(5);
  });
});
