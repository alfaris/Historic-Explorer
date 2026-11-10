import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DETOUR_FACTOR, walkMinutes, walkPlan } from './walk';
import { distanceMeters } from './geo';

const place = (id: number, lat: number, mustSee = false, category = 'monument', routeId = 'r') => ({ id, routeId, category, lat, lng: 31.26, mustSee });
// 0.001° of latitude is about 111 m.
const places = [
  place(1, 30.04, true),
  place(2, 30.041),
  place(3, 30.042, true),
  place(4, 30.0425, false, 'coffee'),
  place(5, 30.044, true),
  place(6, 30.05, true, 'monument', 'other'),
];

// A stand-in for the browser's storage; writes fail while `failWrites` is set.
const data = new Map<string, string>();
let failWrites = false;
beforeEach(() => {
  data.clear();
  failWrites = false;
  vi.resetModules();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrites) throw new Error('QuotaExceeded');
        data.set(k, v);
      },
      removeItem: (k: string) => data.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());
const stored = () => JSON.parse(data.get('cairo-walks:short-walk') ?? 'null');

describe('short walk', () => {
  it("keeps the route's must-see stops in walking order, its extras and other routes", async () => {
    const { mustSeeStops, shortWalkPlaces, hasShortWalk } = await import('./short-walk');
    expect(mustSeeStops(places, 'r').map(p => p.id)).toEqual([1, 3, 5]);
    expect(shortWalkPlaces(places, 'r').map(p => p.id)).toEqual([1, 3, 4, 5, 6]);
    expect(hasShortWalk(places, 'r')).toBe(true);
    // One must-see stop isn't a walk.
    expect(hasShortWalk(places, 'other')).toBe(false);
    expect(hasShortWalk(places.map(p => ({ ...p, mustSee: p.id === 1 })), 'r')).toBe(false);
  });

  it('numbers the stops of the short walk only ("Stop 2 of 3")', async () => {
    const { shortWalkPlaces } = await import('./short-walk');
    const plan = walkPlan(shortWalkPlaces(places, 'r'), 'r');
    expect(plan.get(3)).toMatchObject({ number: 2, total: 3 });
    expect(plan.get(3)?.leg?.next.id).toBe(5);
    expect(plan.has(2)).toBe(false);
  });

  it('works out its distance and time between the must-see stops', async () => {
    const { shortWalkStats } = await import('./short-walk');
    const legs = [distanceMeters(places[0], places[2]), distanceMeters(places[2], places[4])];
    const stats = shortWalkStats(places, 'r');
    expect(stats.stops).toBe(3);
    expect(stats.meters).toBe(Math.round(((legs[0] + legs[1]) * DETOUR_FACTOR) / 100) * 100);
    expect(stats.minutes).toBe(walkMinutes(legs[0]) + walkMinutes(legs[1]));
  });
});

describe('planning and printing a short walk', () => {
  it('times only the must-see stops, walking straight between them', async () => {
    const { shortWalkPlaces, shortWalkStats } = await import('./short-walk');
    const { visitPlan } = await import('./visit-plan');
    const start = new Date('2027-01-05T08:00:00Z');
    const plan = visitPlan(shortWalkPlaces(places, 'r'), 'r', start, 20, []);
    expect(plan.stops.map(s => [s.place.id, s.number])).toEqual([[1, 1], [3, 2], [5, 3]]);
    expect(plan.stops[1].walkMinutes).toBe(walkMinutes(distanceMeters(places[0], places[2])));
    // Three stays of 20 minutes plus the walking the header shows.
    const { minutes } = shortWalkStats(places, 'r');
    expect((plan.finish!.getTime() - start.getTime()) / 60_000).toBe(3 * 20 + minutes);
  });
});

describe('continuing a short walk', () => {
  it("picks the next stop from the short walk when it's on, as the walk it opens does", async () => {
    const { walkedPlaces } = await import('./short-walk');
    const { routeToContinue } = await import('./walk-summary');
    const routes = [{ id: 'r' }, { id: 'other' }];
    // Stop 1 (must-see) visited; stop 2 isn't must-see.
    const visited = new Set([1]);
    expect(routeToContinue(routes, places, visited)?.next.id).toBe(2);
    expect(routeToContinue(routes, walkedPlaces(places, new Set(['r'])), visited)?.next.id).toBe(3);
    // Every must-see stop visited: the short walk is done, so there's nothing to continue on it.
    expect(routeToContinue(routes, walkedPlaces(places, new Set(['r'])), new Set([1, 3, 5]))).toBeNull();
    // A route without a short walk (one must-see stop) is walked in full.
    expect(walkedPlaces(places, new Set(['other']))).toEqual(places);
  });
});

describe('the short walk switch', () => {
  it('is remembered per route on the device', async () => {
    const { setShortWalk, parseRouteIds } = await import('./short-walk');
    setShortWalk('al-muizz', true);
    setShortWalk('coptic-cairo', true);
    setShortWalk('al-muizz', false);
    expect(parseRouteIds(data.get('cairo-walks:short-walk') ?? null)).toEqual(new Set(['coptic-cairo']));
  });

  it("keeps another tab's routes", async () => {
    const { setShortWalk } = await import('./short-walk');
    data.set('cairo-walks:short-walk', JSON.stringify(['ahl-al-bayt']));
    setShortWalk('al-muizz', true);
    expect(stored()).toEqual(['ahl-al-bayt', 'al-muizz']);
  });

  it('keeps a change that could not be written, and writes it with the next one', async () => {
    const { setShortWalk } = await import('./short-walk');
    failWrites = true;
    setShortWalk('al-muizz', true);
    expect(stored()).toBeNull();
    failWrites = false;
    setShortWalk('coptic-cairo', true);
    expect(stored()).toEqual(['al-muizz', 'coptic-cairo']);
  });

  it('ignores malformed stored values', async () => {
    const { parseRouteIds } = await import('./short-walk');
    expect(parseRouteIds('nope')).toEqual(new Set());
    expect(parseRouteIds(JSON.stringify(['ok-route', 3, 'Bad ID', '']))).toEqual(new Set(['ok-route']));
  });
});

describe('mustSee in saved content', () => {
  it('is kept only as true', async () => {
    const { normalizeContent, bundledContent } = await import('../data/content');
    const raw = structuredClone(bundledContent) as any;
    raw.places[0].mustSee = true;
    raw.places[1].mustSee = 'yes';
    const c = normalizeContent(raw);
    expect(c.places[0].mustSee).toBe(true);
    expect(c.places[1]).not.toHaveProperty('mustSee');
  });
});
