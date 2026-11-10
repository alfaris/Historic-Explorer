// "Open now" for a whole route: how many of its stops with known hours are
// open at this moment, and how many of those close within the hour. Uses the
// same rules as each place's card (Cairo time, special hours). Pure.

import type { OpeningHours } from './opening-hours';
import { cairoTime } from './opening-hours';
import { openStatusAt, type SpecialPeriod } from './special-hours';

export const CLOSING_SOON_MINUTES = 60;

export type RouteOpenNow = { known: number; open: number; closingSoon: number };

/** Counts for these stops at `at`; `known` is how many have hours for now (others aren't counted). */
export function routeOpenNow(stops: { id: number; hours?: OpeningHours }[], at: Date, periods: SpecialPeriod[] | undefined): RouteOpenNow {
  const now = cairoTime(at).minutes;
  let known = 0;
  let open = 0;
  let closingSoon = 0;
  for (const stop of stops) {
    const status = openStatusAt(stop, at, periods);
    if (!status) continue;
    known++;
    if (!status.open) continue;
    open++;
    if (status.closes) {
      const left = status.closes.inDays * 1440 + status.closes.minutes - now;
      if (left <= CLOSING_SOON_MINUTES) closingSoon++;
    }
  }
  return { known, open, closingSoon };
}
