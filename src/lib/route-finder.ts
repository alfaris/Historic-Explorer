// "Which walk is for me?": ranks the routes for the time a visitor has and
// what they like, from each route's walking time and its places. Pure, so it
// works offline and is tested.

import type { Location, Route } from '../data/locations';
import { isActiveMosque } from './prayer-times';
import { routeAccess, stepFreeShare } from './step-free';

export type TimeChoice = 'short' | 'medium' | 'long';
export type Interest = 'mosques' | 'museums' | 'food' | 'crafts';
export const INTERESTS: Interest[] = ['mosques', 'museums', 'food', 'crafts'];

/** The hours each time choice means. */
const TIME_RANGE: Record<TimeChoice, [number, number]> = { short: [0.5, 1.5], medium: [2, 3], long: [3.5, 6] };

const SHRINE = /\b(mausoleum|shrine|tomb)\b|ضريح|مقام|قبة|مشهد/i;

type Place = Pick<Location, 'routeId' | 'category' | 'nameEn' | 'nameAr' | 'mosque'> & Partial<Pick<Location, 'tips'>>;

/** How many of a route's places suit each interest. */
export function routeProfile(places: Place[], routeId: string): Record<Interest, number> {
  const counts: Record<Interest, number> = { mosques: 0, museums: 0, food: 0, crafts: 0 };
  for (const p of places) {
    if (p.routeId !== routeId) continue;
    if (p.category === 'monument') {
      if (isActiveMosque(p) || SHRINE.test(p.nameEn) || SHRINE.test(p.nameAr)) counts.mosques++;
      else counts.museums++;
    } else if (p.category === 'coffee' || p.category === 'restaurant') counts.food++;
    else if (p.category === 'workshop' || p.category === 'stationary') counts.crafts++;
  }
  return counts;
}

/** 1 when the route's hours overlap the time chosen, less the further apart they are. */
export function timeFit(route: Pick<Route, 'hoursMin' | 'hoursMax'>, time: TimeChoice): number {
  const [lo, hi] = TIME_RANGE[time];
  const min = route.hoursMin > 0 ? route.hoursMin : route.hoursMax;
  const max = route.hoursMax > 0 ? route.hoursMax : min;
  if (!(max > 0)) return 0.5; // unknown: neither good nor bad
  const gap = max < lo ? lo - max : min > hi ? min - hi : 0;
  return 1 / (1 + 2 * gap);
}

export type Suggestion<R> = { route: R; profile: Record<Interest, number>; score: number; stepFree: number };

/**
 * The best one or two routes, by how well the time fits and the chosen
 * interests (each route's count relative to the route with the most). A second
 * suggestion only when it's close to the first. Asked for step-free access,
 * the routes with more step-free stops come first, then the best fit among them.
 */
export function suggestRoutes<R extends Pick<Route, 'id' | 'hoursMin' | 'hoursMax'>>(
  routes: R[],
  places: Place[],
  time: TimeChoice | null,
  interests: Interest[],
  stepFree = false,
): Suggestion<R>[] {
  if (!time && interests.length === 0 && !stepFree) return [];
  const profiles = routes.map(r => routeProfile(places, r.id));
  const most = Object.fromEntries(INTERESTS.map(i => [i, Math.max(1, ...profiles.map(p => p[i]))])) as Record<Interest, number>;
  const ranked = routes
    .map((route, i) => {
      // Time matters most, but not so much that a walk with none of what was asked for wins.
      const fit = time ? timeFit(route, time) * 2 : 0;
      const liking = interests.reduce((s, k) => s + (1.5 * profiles[i][k]) / most[k], 0);
      return { route, profile: profiles[i], score: fit + liking, stepFree: stepFreeShare(routeAccess(places, route.id)) };
    })
    .sort((a, b) => (stepFree ? b.stepFree - a.stepFree : 0) || b.score - a.score || routes.indexOf(a.route) - routes.indexOf(b.route));
  const [first] = ranked;
  // The second is as step-free (to within a stop in ten) and fits nearly as well.
  return ranked.slice(0, 2).filter((s, i) => i === 0 || (s.score >= first.score * 0.8 && (!stepFree || s.stepFree >= first.stepFree - 0.1)));
}
