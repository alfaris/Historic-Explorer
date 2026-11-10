// The short walk's maths (see short-walk.ts): which stops it keeps, and its
// length and time. Pure and without React, so the link-preview function on the
// server can use it too.

import { distanceMeters } from './geo.js';
import { DETOUR_FACTOR, STOP_CATEGORIES, walkMinutes, walkStops } from './walk.js';
import type { Point } from './geo.js';

type Place = Point & { id: number; routeId: string; category: string; mustSee?: boolean };

/** Fewer must-see stops than this, and the route has no short walk. */
export const SHORT_WALK_MIN = 2;

/** The route's must-see stops, in walking order. */
export const mustSeeStops = <T extends Place>(places: T[], routeId: string): T[] => walkStops(places, routeId).filter(p => p.mustSee);

/** Whether the route has a short walk (at least SHORT_WALK_MIN must-see stops). */
export const hasShortWalk = (places: Place[], routeId: string) => mustSeeStops(places, routeId).length >= SHORT_WALK_MIN;

/** The places with this route's other stops left out (its must-see stops, extras and other routes stay, in order). */
export const shortWalkPlaces = <T extends Place>(places: T[], routeId: string): T[] =>
  places.filter(p => p.routeId !== routeId || !STOP_CATEGORIES.has(p.category) || p.mustSee);

/**
 * The places as walked: on each route in `onFor` that has a short walk, its
 * other stops are left out. What "Continue your walk" picks the next stop
 * from, so it matches the walk it opens.
 */
export const walkedPlaces = <T extends Place>(places: T[], onFor: Set<string>): T[] =>
  [...onFor].filter(id => hasShortWalk(places, id)).reduce((ps, id) => shortWalkPlaces(ps, id), places);

/** The short walk's length (straight line × detour, to the nearest 100 m) and time, walking its stops in order. */
export function shortWalkStats(places: Place[], routeId: string): { stops: number; meters: number; minutes: number } {
  const stops = mustSeeStops(places, routeId);
  let straight = 0;
  let minutes = 0;
  for (let i = 1; i < stops.length; i++) {
    const d = distanceMeters(stops[i - 1], stops[i]);
    straight += d;
    minutes += walkMinutes(d);
  }
  return { stops: stops.length, meters: Math.round((straight * DETOUR_FACTOR) / 100) * 100, minutes };
}

