// "Take a break" in walk mode: the nearest cafés and restaurants, and the
// nearest place with toilets, from the visitor (or the current stop). Pure, so
// it works offline and is tested.

import type { Location } from '../data/locations';
import { distanceMeters, type Point } from './geo';
import { openStatusAt, type SpecialPeriod } from './special-hours';
import { walkMinutes } from './walk';

/** Farther than this isn't a break on the way: about a 25-minute walk. */
export const BREAK_MAX_METERS = 1500;
const FOOD = new Set(['coffee', 'restaurant']);

export type BreakPlace<T> = { place: T; meters: number; minutes: number; open: boolean | null };

type Place = Pick<Location, 'id' | 'category' | 'lat' | 'lng' | 'hours' | 'tips'>;

function rank<T extends Place>(places: T[], from: Point, now: Date, periods?: SpecialPeriod[]): BreakPlace<T>[] {
  return places
    .map(place => {
      const meters = distanceMeters(from, place);
      const status = openStatusAt(place, now, periods);
      return { place, meters, minutes: walkMinutes(meters), open: status ? status.open : null };
    })
    .filter(b => b.meters <= BREAK_MAX_METERS)
    // Closed ones last (unknown hours count as maybe open), then the nearest.
    .sort((a, b) => Number(a.open === false) - Number(b.open === false) || a.meters - b.meters);
}

/** Up to `limit` cafés and restaurants, and the nearest place with toilets, on any route. */
export function nearestBreaks<T extends Place>(places: T[], from: Point, now: Date, periods?: SpecialPeriod[], limit = 3) {
  return {
    food: rank(places.filter(p => FOOD.has(p.category)), from, now, periods).slice(0, limit),
    toilets: rank(places.filter(p => p.tips?.toilets === true), from, now, periods)[0] ?? null,
  };
}
