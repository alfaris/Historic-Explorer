import { describe, expect, it } from 'vitest';
import { locations } from '../data/locations';
import { walkPlan, walkStops } from './walk';
import { justCompleted, walkSummary, routeToContinue } from './walk-summary';

const route = 'ahl-al-bayt';
const stops = walkStops(locations, route);
const plan = walkPlan(locations, route);

describe('walkSummary', () => {
  it('counts nothing before the walk', () => {
    const s = walkSummary(locations, route, new Set());
    expect(s).toMatchObject({ visited: 0, total: stops.length, meters: 0, minutes: 0, complete: false });
    expect(s.stopIds).toEqual(stops.map(p => p.id));
  });

  it('adds the legs between stops that were both visited', () => {
    const [a, b, c] = stops;
    const s = walkSummary(locations, route, new Set([a.id, b.id, c.id]));
    const legs = [plan.get(a.id)!.leg!, plan.get(b.id)!.leg!];
    expect(s.visited).toBe(3);
    expect(s.meters).toBe(Math.round(legs[0].meters + legs[1].meters));
    expect(s.minutes).toBe(legs[0].minutes + legs[1].minutes);
    // Skipping the middle stop: no walk counted between the other two.
    expect(walkSummary(locations, route, new Set([a.id, c.id])).meters).toBe(0);
  });

  it('is complete when every stop is visited; other places on the route don’t count', () => {
    const all = new Set(stops.map(p => p.id));
    const s = walkSummary(locations, route, all);
    expect(s.complete).toBe(true);
    expect(s.meters).toBeGreaterThan(1000);
    const extra = locations.find(p => p.routeId === route && p.category !== 'monument');
    if (extra) expect(walkSummary(locations, route, new Set([extra.id])).visited).toBe(0);
  });

  it('is never complete for a route without stops', () => {
    expect(walkSummary(locations, 'nope', new Set()).complete).toBe(false);
  });
});

describe('justCompleted', () => {
  const done = walkSummary(locations, route, new Set(stops.map(p => p.id)));
  it('fires only on the change to complete', () => {
    expect(justCompleted(done.total - 1, done)).toBe(true);
    expect(justCompleted(done.total, done)).toBe(false); // already complete
    expect(justCompleted(null, done)).toBe(false); // finished on an earlier visit
    expect(justCompleted(0, walkSummary(locations, route, new Set()))).toBe(false);
  });
});

describe('routeToContinue', () => {
  const routes = [{ id: 'a' }, { id: 'b' }];
  const stop = (id: number, routeId: string, lat: number) => ({ id, routeId, category: 'monument', lat, lng: 31.25 });
  const places = [stop(1, 'a', 30), stop(2, 'a', 30.001), stop(3, 'a', 30.002), stop(4, 'b', 30.01), stop(5, 'b', 30.011)];
  it('offers nothing before any stop is visited, or once a route is finished', () => {
    expect(routeToContinue(routes, places, new Set())).toBeNull();
    expect(routeToContinue(routes, places, new Set([4, 5]))).toBeNull();
  });
  it('names the route and the next unvisited stop', () => {
    const r = routeToContinue(routes, places, new Set([1]))!;
    expect(r.route.id).toBe('a');
    expect(r.summary.visited).toBe(1);
    expect(r.next.id).toBe(2);
  });
  it('prefers the route on screen, else the one with most visited', () => {
    const visited = new Set([1, 2, 4]);
    expect(routeToContinue(routes, places, visited)!.route.id).toBe('a');
    expect(routeToContinue(routes, places, visited, 'b')!.route.id).toBe('b');
    expect(routeToContinue(routes, places, visited, 'b')!.next.id).toBe(5);
  });
  it('the next stop is the first unvisited one, even after skipping ahead', () => {
    expect(routeToContinue(routes, places, new Set([1, 3]))!.next.id).toBe(2);
  });
});
