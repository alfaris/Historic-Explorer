// "Nearby": places on other routes a short walk from this one. Routes in old
// Cairo overlap, so a stop on one is often minutes from a stop on another.
// Pure, so it works offline and is tested.

import { distanceMeters, type Point } from './geo';
import { walkMinutes } from './walk';

/** At most this many minutes' walk (the app's estimate: straight line × detour, at a sightseeing pace). */
export const NEARBY_MINUTES = 7;
export const NEARBY_MAX = 3;

/** Places on other routes within NEARBY_MINUTES' walk of `place`, nearest first, at most NEARBY_MAX. */
export function nearbyOnOtherRoutes<P extends Point & { id: number; routeId: string }>(place: P, places: P[]): { place: P; minutes: number }[] {
  return places
    .filter(p => p.routeId !== place.routeId && p.id !== place.id)
    .map(p => ({ place: p, meters: distanceMeters(place, p) }))
    .filter(x => walkMinutes(x.meters) <= NEARBY_MINUTES)
    .sort((a, b) => a.meters - b.meters || a.place.id - b.place.id)
    .slice(0, NEARBY_MAX)
    .map(x => ({ place: x.place, minutes: walkMinutes(x.meters) }));
}
