import { describe, expect, it } from 'vitest';
import { distanceLabel, PIN_FAR_METERS, pinsToCheck, withPinConfirmed } from './pin-check';
import { bundledContent, normalizeContent, type Content, type Location } from '../data/content';

const place = (id: number, routeId: string, lat: number, lng: number): Location => ({
  id, routeId, nameEn: `P${id}`, nameAr: `م${id}`, category: 'monument', descriptionEn: '', descriptionAr: '', lat, lng,
});
// 0.001° of latitude is about 111 m.
const content = (places: Location[]) => ({ routes: [], places } as unknown as Content);

describe('pinsToCheck', () => {
  const near = [place(1, 'a', 30.04, 31.26), place(2, 'a', 30.041, 31.26), place(3, 'a', 30.042, 31.26)];

  it('lists a place far from every other place on its route, with the distance', () => {
    const rows = pinsToCheck(content([...near, place(4, 'a', 30.06, 31.26)]));
    expect(rows.map(r => r.place.id)).toEqual([4]);
    expect(rows[0].meters).toBeGreaterThan(1900);
    expect(rows[0].meters).toBeLessThan(2100);
  });

  it('leaves out places within the threshold, and places on other routes', () => {
    const justIn = place(4, 'a', 30.042 + (PIN_FAR_METERS - 50) / 111_000, 31.26);
    expect(pinsToCheck(content([...near, justIn]))).toEqual([]);
    // Far from route a, but it's on its own route b with a near neighbour.
    expect(pinsToCheck(content([...near, place(5, 'b', 30.1, 31.26), place(6, 'b', 30.1005, 31.26)]))).toEqual([]);
  });

  it("doesn't list a route's only place", () => {
    expect(pinsToCheck(content([...near, place(7, 'c', 30.2, 31.3)]))).toEqual([]);
  });

  it('lists the furthest first', () => {
    const rows = pinsToCheck(content([...near, place(4, 'a', 30.06, 31.26), place(5, 'a', 30.01, 31.26)]));
    expect(rows.map(r => r.place.id)).toEqual([5, 4]);
  });

  it('leaves out a confirmed pin until it moves', () => {
    const c = withPinConfirmed(content([...near, place(4, 'a', 30.06, 31.26)]), 4);
    expect(pinsToCheck(c)).toEqual([]);
    const moved = { ...c, places: c.places.map(p => (p.id === 4 ? { ...p, lat: 30.061 } : p)) };
    expect(pinsToCheck(moved).map(r => r.place.id)).toEqual([4]);
  });
});

describe('pinChecked in saved content', () => {
  const base = normalizeContent(structuredClone(bundledContent));
  const first = base.places[0];

  it('is kept while the pin is where it was confirmed', () => {
    const c = withPinConfirmed(base, first.id);
    expect(normalizeContent(JSON.parse(JSON.stringify(c))).places[0].pinChecked).toEqual({ lat: first.lat, lng: first.lng });
  });

  it('is dropped once the pin has moved, or when malformed', () => {
    const c = withPinConfirmed(base, first.id);
    const moved = { ...c, places: c.places.map((p, i) => (i === 0 ? { ...p, lng: p.lng + 0.001 } : p)) };
    expect(normalizeContent(JSON.parse(JSON.stringify(moved))).places[0]).not.toHaveProperty('pinChecked');
    const bad = { ...base, places: base.places.map((p, i) => (i === 0 ? { ...p, pinChecked: 'yes' } : p)) };
    expect(normalizeContent(JSON.parse(JSON.stringify(bad))).places[0]).not.toHaveProperty('pinChecked');
  });
});

describe('distanceLabel', () => {
  it('shows kilometres from 1 km, else metres', () => {
    expect(distanceLabel(1834)).toBe('1.8 km');
    expect(distanceLabel(846)).toBe('850 m');
  });
});
