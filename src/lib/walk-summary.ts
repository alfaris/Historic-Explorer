// The end of a walk: how much of a route's stops the visitor has seen, and
// roughly how far they walked. Uses the walk plan (straight-line distance with
// the detour factor), so it needs no location history and works offline.

import { walkPlan, walkStops } from './walk';
import type { Point } from './geo';

type Place = Point & { id: number; routeId: string; category: string };

export interface WalkSummary {
  /** The route's stops, in walking order. */
  stopIds: number[];
  visited: number;
  total: number;
  /** Planned walking distance between consecutive stops that were both visited. */
  meters: number;
  minutes: number;
  complete: boolean;
}

export function walkSummary(places: Place[], routeId: string, visited: Set<number>): WalkSummary {
  const stops = walkStops(places, routeId);
  const plan = walkPlan(places, routeId);
  let meters = 0;
  let minutes = 0;
  for (const stop of stops) {
    const leg = plan.get(stop.id)?.leg;
    if (leg && visited.has(stop.id) && visited.has(leg.next.id)) {
      meters += leg.meters;
      minutes += leg.minutes;
    }
  }
  const done = stops.filter(s => visited.has(s.id)).length;
  return {
    stopIds: stops.map(s => s.id),
    visited: done,
    total: stops.length,
    meters: Math.round(meters),
    minutes,
    complete: stops.length > 0 && done === stops.length,
  };
}

/**
 * Whether a route was just completed: every stop is visited now, and wasn't
 * before. `before` is null on first sight (e.g. on page load), which never
 * counts, so a route finished on an earlier visit doesn't pop up again.
 */
export const justCompleted = (before: number | null, now: WalkSummary) =>
  now.complete && before !== null && before < now.total;
