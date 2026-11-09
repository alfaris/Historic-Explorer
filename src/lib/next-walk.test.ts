import { describe, expect, it } from 'vitest';
import type { Location, Route } from '../data/locations';
import { FAR_METERS, lastStamped, nextWalk } from './next-walk';
import type { Stamps } from './passport';
import { routes as allRoutes, locations as allPlaces } from '../data/locations';

// Three small routes on a line running east: A ends at 0.000, B starts 0.009° east (~870 m), C ~5 km away.
const place = (id: number, routeId: string, lng: number, category: Location['category'] = 'monument'): Location =>
  ({ id, routeId, nameEn: `P${id}`, nameAr: 'م', category, descriptionEn: '', descriptionAr: '', lat: 30.05, lng }) as Location;
const route = (id: string, startId?: number): Route => ({ id, ...(startId ? { startId } : {}) }) as Route;
const places = [
  place(1, 'a', 31.25),
  place(2, 'a', 31.255),
  place(3, 'b', 31.264),
  place(4, 'b', 31.27),
  place(5, 'c', 31.31),
  place(6, 'c', 31.32),
];
const routes = [route('a'), route('b'), route('c')];
const stamp = { date: '2026-11-09', found: 0, spots: 0 };

describe('nextWalk', () => {
  it('suggests the nearest unstamped start, on foot when close', () => {
    const next = nextWalk('a', routes, places, { a: stamp });
    expect(next).toMatchObject({ kind: 'next', route: { id: 'b' }, start: { id: 3 }, far: false });
    if (next?.kind !== 'next') throw new Error();
    expect(next.meters).toBeGreaterThan(900);
    expect(next.meters).toBeLessThan(1200);
    expect(next.minutes).toBeGreaterThan(10);
    expect(next.minutes).toBeLessThan(18);
  });

  it('skips stamped routes, and says when it is far', () => {
    const next = nextWalk('a', routes, places, { a: stamp, b: stamp });
    expect(next).toMatchObject({ kind: 'next', route: { id: 'c' }, far: true });
    if (next?.kind === 'next') expect(next.meters).toBeGreaterThan(FAR_METERS);
  });

  it("uses the admin's start point, not only the first stop", () => {
    // B set to start at its far stop (4), which is still nearer than C.
    const next = nextWalk('a', [route('a'), route('b', 4), route('c')], places, {});
    expect(next).toMatchObject({ route: { id: 'b' }, start: { id: 4 } });
  });

  it('says so when every route is stamped, and suggests nothing without one to suggest', () => {
    expect(nextWalk('a', routes, places, { a: stamp, b: stamp, c: stamp })).toEqual({ kind: 'allDone' });
    // Only this route is left (finished but its stamp not saved): nothing to suggest.
    expect(nextWalk('a', routes, places, { b: stamp, c: stamp })).toBeNull();
    expect(nextWalk('nope', routes, places, {})).toBeNull();
  });

  it('finds a next walk for every built-in route', () => {
    for (const r of allRoutes) {
      const next = nextWalk(r.id, allRoutes, allPlaces, { [r.id]: stamp });
      expect(next?.kind, r.id).toBe('next');
    }
  });
});

describe('lastStamped', () => {
  it('is the route with the latest stamp date', () => {
    const stamps: Stamps = { a: { ...stamp, date: '2026-10-01' }, c: { ...stamp, date: '2026-11-02' }, b: { ...stamp, date: '2026-11-01' } };
    expect(lastStamped(routes, stamps)?.id).toBe('c');
    expect(lastStamped(routes, {})).toBeUndefined();
    // Two walks finished the same day: the later time wins, whatever the route order.
    const sameDay: Stamps = { a: { ...stamp, at: 2_000 }, b: { ...stamp, at: 1_000 } };
    expect(lastStamped(routes, sameDay)?.id).toBe('a');
    expect(lastStamped(routes, { a: { ...stamp, at: 1_000 }, b: stamp })?.id).toBe('a');
  });
});
