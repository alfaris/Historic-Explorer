// Filtering and counting reports against an in-memory Blob.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const unreadable = new Set<string>(); // paths whose read fails, as if Blob hiccuped
vi.mock('@vercel/blob', () => ({
  async put(pathname: string, body: string) {
    store.set(pathname, body);
    return { pathname };
  },
  async get(pathname: string) {
    if (unreadable.has(pathname)) throw new Error('Blob unavailable');
    const b = store.get(pathname);
    return b === undefined ? null : { statusCode: 200, stream: new Response(b).body };
  },
  async list({ prefix = '' }: { prefix?: string } = {}) {
    return { blobs: [...store.keys()].filter(p => p.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false };
  },
  async del(p: string) {
    store.delete(p);
  },
}));

const { listReports, openReportCounts, updateReport } = await import('./reports');

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const add = (n: number, placeId: number, type: string, { legacy = false, status = 'open' } = {}) => {
  const createdAt = `2026-11-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`;
  const name = `${createdAt.replace(/[:.]/g, '-')}_${uuid(n)}${legacy ? '' : `_p${placeId}_${type}`}.json`;
  const path = `reports/${status}/${name}`;
  store.set(path, JSON.stringify({ id: uuid(n), createdAt, status, type, placeId, placeName: `Place ${placeId}`, message: 'x', lang: 'en' }));
  return path;
};

beforeEach(() => {
  store.clear();
  unreadable.clear();
});

describe('filtered reports', () => {
  it('filters new and older reports by place and type, with counts that follow', async () => {
    add(1, 1, 'text');
    add(2, 2, 'closed', { legacy: true });
    add(3, 1, 'location', { status: 'resolved' });
    add(4, 3, 'closed');
    const byPlace = await listReports('open', 0, 50, { placeIds: [1, 2] });
    expect(byPlace.reports.map(r => r.placeId)).toEqual([2, 1]);
    expect(byPlace.counts).toEqual({ open: 2, resolved: 1, dismissed: 0 });
    const closed = await listReports('all', 0, 50, { type: 'closed' });
    expect(closed.reports.map(r => r.placeId)).toEqual([3, 2]);
    expect(await openReportCounts()).toEqual({ 1: 1, 2: 1, 3: 1 });
  });

  it("tries an older report again after a failed read, rather than leaving it out for good", async () => {
    const path = add(5, 7, 'photo', { legacy: true });
    unreadable.add(path);
    expect(await openReportCounts()).toEqual({});
    unreadable.delete(path);
    expect(await openReportCounts()).toEqual({ 7: 1 });
  });

  it('re-files an older report under the new name when its status changes', async () => {
    add(6, 9, 'text', { legacy: true });
    await updateReport(uuid(6), { status: 'resolved' });
    expect([...store.keys()]).toEqual([`reports/resolved/2026-11-16T10-00-00-000Z_${uuid(6)}_p9_text.json`]);
  });
});
