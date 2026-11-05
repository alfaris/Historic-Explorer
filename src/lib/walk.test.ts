import { describe, expect, it } from 'vitest';
import { locations, routes } from '../data/locations';
import { applyStopOrder, walkMinutes, walkPlan, walkStops } from './walk';

const P = (id: number, lat: number, lng: number, category = 'monument', routeId = 'r') => ({ id, lat, lng, category, routeId });

describe('walkMinutes', () => {
  it('estimates a walk from the straight-line distance', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(300)).toBe(5); // 390 m walked at 75 m/min
    expect(walkMinutes(1000)).toBe(17);
  });
});

describe('walkPlan', () => {
  const places = [P(1, 30.0, 31.0), P(2, 30.001, 31.0, 'coffee'), P(3, 30.002, 31.0), P(4, 30.004, 31.0), P(9, 30.1, 31.1, 'monument', 'other')];

  it('numbers only the route’s monuments, in list order', () => {
    const plan = walkPlan(places, 'r');
    expect([...plan.keys()]).toEqual([1, 3, 4]);
    expect(plan.get(3)).toMatchObject({ number: 2, total: 3 });
    expect(plan.has(2)).toBe(false);
  });

  it('gives each stop the walk to the next, and none after the last', () => {
    const plan = walkPlan(places, 'r');
    const leg = plan.get(1)!.leg!;
    expect(leg.next.id).toBe(3);
    expect(Math.round(leg.meters)).toBe(289); // ~222 m straight × 1.3
    expect(leg.minutes).toBe(4);
    expect(plan.get(4)!.leg).toBeNull();
  });

  it('gives every real route a plan whose legs are a walkable length', () => {
    for (const route of routes) {
      const plan = walkPlan(locations, route.id);
      expect(plan.size).toBeGreaterThan(1);
      for (const { leg } of plan.values()) if (leg) expect(leg.minutes).toBeLessThan(60);
    }
  });

  it('follows list order, not ID order (the Fustat route mixes old and new IDs)', () => {
    const stops = walkStops(locations, 'fustat-roda').map(s => s.id);
    expect(stops.indexOf(401)).toBeLessThan(stops.indexOf(202));
  });
});

describe('applyStopOrder', () => {
  const places = [P(1, 0, 0), P(50, 0, 0, 'coffee'), P(2, 0, 0), P(3, 0, 0), P(7, 0, 0, 'monument', 'other'), P(4, 0, 0)];

  it('reorders stops in their own slots, leaving everything else in place', () => {
    const out = applyStopOrder(places, 'r', [3, 1, 4, 2]);
    expect(out.map(p => p.id)).toEqual([3, 50, 1, 4, 7, 2]);
  });

  it('ignores unknown or duplicate IDs and keeps unlisted stops after the listed ones', () => {
    const out = applyStopOrder(places, 'r', [4, 99, 4, 7]);
    expect(out.map(p => p.id)).toEqual([4, 50, 1, 2, 7, 3]);
  });

  it('keeps the same places', () => {
    const out = applyStopOrder(places, 'r', [2, 3]);
    expect(out.map(p => p.id).sort()).toEqual(places.map(p => p.id).sort());
  });
});
