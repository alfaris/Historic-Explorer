import { describe, expect, it, vi } from 'vitest';
import { mergeStamps, parseStamps, stampCount, stampDate, withStamp } from './passport';
import { stampGrid } from './passport-image';

describe('withStamp', () => {
  it('stamps a route with the day and the Spot it challenges found', () => {
    expect(withStamp({}, 'al-muizz', '2026-11-08', { found: 2, total: 3 })).toEqual({ 'al-muizz': { date: '2026-11-08', found: 2, spots: 3 } });
  });
  it('keeps the first date when walked again, adding challenges found since', () => {
    const first = withStamp({}, 'al-muizz', '2026-11-08', { found: 1, total: 3 });
    const again = withStamp(first, 'al-muizz', '2026-12-01', { found: 3, total: 3 });
    expect(again['al-muizz']).toEqual({ date: '2026-11-08', found: 3, spots: 3 });
    // Nothing new (fewer found this time): the same object, so nothing is written.
    expect(withStamp(again, 'al-muizz', '2026-12-02', { found: 0, total: 3 })).toBe(again);
  });
});

describe('parseStamps', () => {
  it('keeps well-formed stamps only', () => {
    const raw = JSON.stringify({ a: { date: '2026-11-08', found: 5, spots: 2 }, b: { date: 'yesterday' }, c: 'x', d: { date: '2026-01-02' } });
    expect(parseStamps(raw)).toEqual({ a: { date: '2026-11-08', found: 2, spots: 2 }, d: { date: '2026-01-02', found: 0, spots: 0 } });
    expect(parseStamps('[1]')).toEqual({});
    expect(parseStamps('{')).toEqual({});
    expect(parseStamps(null)).toEqual({});
  });
});

describe('stampCount and stampDate', () => {
  it('counts stamps of routes that still exist', () => {
    expect(stampCount({ a: { date: '2026-11-08', found: 0, spots: 0 }, gone: { date: '2026-11-08', found: 0, spots: 0 } }, [{ id: 'a' }, { id: 'b' }])).toBe(1);
  });
  it('writes the date in each language, with Western digits', () => {
    expect(stampDate('2026-11-08', 'en')).toBe('8 Nov 2026');
    expect(stampDate('2026-11-08', 'ar')).toMatch(/^8 .+ 2026$/);
    expect(stampDate('2026-11-08', 'fr')).toMatch(/^8 nov\.? 2026$/);
  });
});

describe('stampGrid', () => {
  it('puts five stamps in a row of three and a centred row of two', () => {
    const spots = stampGrid(5, 1080);
    expect(spots.map(s => s.x)).toEqual([180, 540, 900, 360, 720]);
    expect(new Set(spots.slice(0, 3).map(s => s.y)).size).toBe(1);
    expect(spots[3].y).toBeGreaterThan(spots[0].y);
    // Circles don't overlap each other or the edges.
    expect(spots[0].r * 2).toBeLessThan(360);
    expect(spots[0].x - spots[0].r).toBeGreaterThan(0);
  });
});

describe('stampRoute', () => {
  it("keeps a stamp another tab added since this tab read the passport", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.resetModules();
    const { stampRoute } = await import('./passport');
    stampRoute('al-muizz', '2026-11-08', { found: 0, total: 0 });
    // Another tab stamps a route; this tab hasn't seen its storage event yet.
    const other = JSON.parse(store.get('cairo-walks:passport')!);
    store.set('cairo-walks:passport', JSON.stringify({ ...other, 'coptic-cairo': { date: '2026-11-08', found: 1, spots: 2 } }));
    stampRoute('fustat-roda', '2026-11-09', { found: 0, total: 0 });
    expect(Object.keys(JSON.parse(store.get('cairo-walks:passport')!)).sort()).toEqual(['al-muizz', 'coptic-cairo', 'fustat-roda']);
    vi.unstubAllGlobals();
  });
});

describe('mergeStamps and a full storage', () => {
  it('merges two sets of stamps, keeping the earlier date and the most found', async () => {
    const { mergeStamps } = await import('./passport');
    expect(mergeStamps({ a: { date: '2026-11-09', found: 2, spots: 3 } }, { a: { date: '2026-11-08', found: 1, spots: 3 }, b: { date: '2026-11-10', found: 0, spots: 0 } })).toEqual({
      a: { date: '2026-11-08', found: 2, spots: 3 },
      b: { date: '2026-11-10', found: 0, spots: 0 },
    });
  });
  it("keeps stamps this tab couldn't save", async () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.resetModules();
    const { stampRoute, stampsNow } = await import('./passport');
    stampRoute('al-muizz', '2026-11-08', { found: 0, total: 0 });
    stampRoute('coptic-cairo', '2026-11-08', { found: 0, total: 0 });
    expect(Object.keys(stampsNow()).sort()).toEqual(['al-muizz', 'coptic-cairo']);
    vi.unstubAllGlobals();
  });
});

describe('stamp times', () => {
  it('keeps the time of the first finish, through walking again, storage and merging', () => {
    const first = withStamp({}, 'a', '2026-11-08', { found: 0, total: 0 }, 1_000);
    expect(first.a.at).toBe(1_000);
    expect(withStamp(first, 'a', '2026-11-08', { found: 1, total: 1 }, 9_000).a.at).toBe(1_000);
    expect(parseStamps(JSON.stringify(first)).a.at).toBe(1_000);
    expect(parseStamps(JSON.stringify({ a: { ...first.a, at: 'x' } })).a.at).toBeUndefined();
    const other = { a: { date: '2026-11-08', found: 0, spots: 0, at: 500 } };
    expect(mergeStamps(first, other).a.at).toBe(500);
    expect(mergeStamps(first, { a: { date: '2026-11-07', found: 0, spots: 0 } }).a).toEqual({ date: '2026-11-07', found: 0, spots: 0 });
  });
});
