// "Next walk": after finishing a route, the nearest route not yet stamped in
// the passport, from where this walk ended. Pure, so it works offline and is
// tested.

import type { Location, Route } from '../data/locations';
import { distanceMeters } from './geo';
import { startPlace } from './getting-there';
import { DETOUR_FACTOR, walkMinutes, walkStops } from './walk';
import type { Stamps } from './passport';

/** Further than this on foot, the metro or a taxi is suggested instead. */
export const FAR_METERS = 2500;

export type NextWalk<R, P> =
  | { kind: 'next'; route: R; start: P; meters: number; minutes: number; far: boolean }
  /** Every route has its stamp. */
  | { kind: 'allDone' };

/**
 * The route to walk next after `fromRouteId`: of the routes without a stamp
 * (other than this one), the one whose start is nearest to this walk's last
 * stop. Walking distance and minutes are estimated as elsewhere (straight
 * line × detour). Null when there's nothing to suggest.
 */
export function nextWalk<R extends Pick<Route, 'id' | 'startId'>, P extends Location>(
  fromRouteId: string,
  routes: R[],
  places: P[],
  stamps: Stamps,
): NextWalk<R, P> | null {
  if (routes.length > 0 && routes.every(r => stamps[r.id])) return { kind: 'allDone' };
  const stops = walkStops(places, fromRouteId);
  const end = stops[stops.length - 1];
  if (!end) return null;
  let best: { route: R; start: P; straight: number } | null = null;
  for (const route of routes) {
    if (route.id === fromRouteId || stamps[route.id]) continue;
    const start = startPlace(route, places);
    if (!start) continue;
    const straight = distanceMeters(end, start);
    if (!best || straight < best.straight) best = { route, start, straight };
  }
  if (!best) return null;
  const meters = Math.round((best.straight * DETOUR_FACTOR) / 50) * 50;
  return { kind: 'next', route: best.route, start: best.start, meters, minutes: walkMinutes(best.straight), far: meters > FAR_METERS };
}

/** The route stamped most recently (the latest date; ties go to the later route in the list), for the passport's suggestion. */
export function lastStamped<R extends { id: string }>(routes: R[], stamps: Stamps): R | undefined {
  let last: R | undefined;
  for (const r of routes) if (stamps[r.id] && (!last || stamps[r.id].date >= stamps[last.id].date)) last = r;
  return last;
}
