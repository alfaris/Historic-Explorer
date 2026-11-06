// "Open now" and "Step-free" filters for the place list and map. Pure, so it
// works offline and is tested.

import type { Location } from '../data/locations';
import { openStatusAt, type SpecialPeriod } from './special-hours';

export type PlaceFilters = { openNow: boolean; stepFree: boolean };
export const NO_FILTERS: PlaceFilters = { openNow: false, stepFree: false };

type Place = Pick<Location, 'id' | 'hours' | 'tips'>;

/** Whether `place` passes the filters that are on, at `now` (special hours applied). */
export function passesFilters(place: Place, filters: PlaceFilters, now: Date, periods?: SpecialPeriod[]): boolean {
  if (filters.openNow && openStatusAt(place, now, periods)?.open !== true) return false;
  // Only places the admin marked step-free: "partly" may still mean steps at the door.
  if (filters.stepFree && place.tips?.wheelchair !== 'yes') return false;
  return true;
}

/** How many of `places` have no hours listed, so "Open now" can say it left them out. */
export const withoutHours = (places: Place[]) => places.filter(p => !p.hours).length;
