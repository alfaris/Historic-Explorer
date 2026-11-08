import { describe, expect, it } from 'vitest';
import { parseStamps, stampCount, stampDate, withStamp } from './passport';
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
