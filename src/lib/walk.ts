// The walking order of a route and the time between its stops.
//
// The stops are the route's monuments, in the order they appear in the
// content (the admin's route editor can reorder them). Cafés, shops and
// meeting points are nearby extras, not stops. Walking times are estimated
// from straight-line distance, so they work offline and need no routing
// service.

import { distanceMeters, type Point } from './geo';

export const STOP_CATEGORIES = new Set(['monument']);

// Streets in old Cairo wind, so a walk is longer than the straight line, and
// people walk a little slower than usual while sightseeing.
export const DETOUR_FACTOR = 1.3;
export const WALK_METERS_PER_MINUTE = 75; // 4.5 km/h

type Place = Point & { id: number; routeId: string; category: string };

/** The route's stops, in walking order. */
export const walkStops = <T extends Place>(places: T[], routeId: string): T[] =>
  places.filter(p => p.routeId === routeId && STOP_CATEGORIES.has(p.category));

/** Estimated walking time, in whole minutes (at least 1). */
export const walkMinutes = (straightMeters: number) =>
  Math.max(1, Math.round((straightMeters * DETOUR_FACTOR) / WALK_METERS_PER_MINUTE));

export type Leg<T> = { next: T; meters: number; minutes: number };
export type StopInfo<T> = { number: number; total: number; leg: Leg<T> | null };

/** For each stop: its number on the route, and the walk to the next stop. */
export function walkPlan<T extends Place>(places: T[], routeId: string): Map<number, StopInfo<T>> {
  const stops = walkStops(places, routeId);
  const plan = new Map<number, StopInfo<T>>();
  stops.forEach((stop, i) => {
    const next = stops[i + 1];
    const meters = next ? distanceMeters(stop, next) * DETOUR_FACTOR : 0;
    plan.set(stop.id, {
      number: i + 1,
      total: stops.length,
      leg: next ? { next, meters, minutes: walkMinutes(distanceMeters(stop, next)) } : null,
    });
  });
  return plan;
}

/**
 * Puts a route's stops in the given order. The stops keep the positions they
 * held in the list; only which stop sits in each position changes, so every
 * other place (and every other route) stays exactly where it was. IDs not
 * among the route's stops are ignored, and stops missing from `order` keep
 * their relative order after the listed ones.
 */
export function applyStopOrder<T extends Place>(places: T[], routeId: string, order: number[]): T[] {
  const stops = walkStops(places, routeId);
  const byId = new Map(stops.map(s => [s.id, s]));
  const listed = order.map(id => byId.get(id)).filter((s): s is T => !!s);
  const unique = [...new Set(listed)];
  const reordered = [...unique, ...stops.filter(s => !unique.includes(s))];
  let i = 0;
  return places.map(p => (p.routeId === routeId && STOP_CATEGORIES.has(p.category) ? reordered[i++] : p));
}
