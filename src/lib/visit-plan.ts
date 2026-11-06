// "Plan my visit": a timetable for a route from a chosen start time. Each stop
// gets an arrival time (the walk between stops plus a set time at each), and a
// flag when it would be closed, close during the visit, or pause for prayer.
// Pure apart from the dates passed in, so it works offline and is tested.

import type { Location } from '../data/locations.js';
import { cairoTime, openStatus, type OpenStatus } from './opening-hours.js';
import { isActiveMosque, pausesAround, type PrayerPause } from './prayer-times.js';
import { walkStops, walkPlan } from './walk.js';
import { effectiveHours, type SpecialPeriod } from './special-hours.js';

const MIN = 60_000;

export const STAY_OPTIONS = [5, 10, 15, 20, 30, 45] as const;
export const DEFAULT_STAY = 20;
/** The earliest and latest start the suggestion looks at, in Cairo time: daylight walks. */
export const EARLIEST_START = 7 * 60;
export const LATEST_START = 17 * 60;
const STEP = 15;

export type PlanFlag =
  /** Closed when the visitor gets there; `status` says when it opens. */
  | { kind: 'closed'; status: OpenStatus }
  /** Open on arrival but closes before the visitor would leave; `status` says when. */
  | { kind: 'closing'; status: OpenStatus }
  /** An active mosque whose prayer pause overlaps the visit. */
  | { kind: 'prayer'; pause: PrayerPause };

export interface PlanStop<T> {
  place: T;
  number: number;
  arrive: Date;
  leave: Date;
  /** Walking minutes from the previous stop (0 for the first). */
  walkMinutes: number;
  flags: PlanFlag[];
}

export interface VisitPlan<T> {
  stops: PlanStop<T>[];
  finish: Date | null;
  /** How many stops have a flag. */
  flagged: number;
  /** How many stops are closed or close during the visit (worse than a prayer pause, which is a wait). */
  closures: number;
}

type Place = Pick<Location, 'id' | 'routeId' | 'category' | 'lat' | 'lng' | 'hours' | 'nameEn' | 'nameAr' | 'mosque'>;

function flagsFor(place: Place, arrive: Date, leave: Date, pauses: PrayerPause[], periods?: SpecialPeriod[]): PlanFlag[] {
  const flags: PlanFlag[] = [];
  // The hours in force on the day of arrival (Ramadan, Eid… included).
  const onArrival = openStatus(effectiveHours(place, arrive, periods).hours, arrive);
  if (onArrival && !onArrival.open) flags.push({ kind: 'closed', status: onArrival });
  else if (onArrival?.open && onArrival.closes) {
    // When it next closes (it may reopen later, e.g. after a midday break), as an instant.
    const { inDays, minutes } = onArrival.closes;
    const closes = arrive.getTime() + (inDays * 24 * 60 + minutes - cairoTime(arrive).minutes) * MIN;
    if (closes < leave.getTime()) flags.push({ kind: 'closing', status: onArrival });
  }
  if (isActiveMosque(place)) {
    const pause = pauses.find(p => p.start < leave && p.end > arrive);
    if (pause) flags.push({ kind: 'prayer', pause });
  }
  return flags;
}

/** The timetable for a route's stops, starting at `start` and spending `stayMinutes` at each. */
export function visitPlan<T extends Place>(
  places: T[],
  routeId: string,
  start: Date,
  stayMinutes = DEFAULT_STAY,
  // Prayer times from the day before the start to the day after cover any walk.
  pauses: PrayerPause[] = pausesAround(start),
  periods?: SpecialPeriod[],
): VisitPlan<T> {
  const stops = walkStops(places, routeId);
  const legs = walkPlan(places, routeId);
  const out: PlanStop<T>[] = [];
  let t = start.getTime();
  let walk = 0;
  stops.forEach((place, i) => {
    t += walk * MIN;
    const arrive = new Date(t);
    const leave = new Date(t + stayMinutes * MIN);
    out.push({ place, number: i + 1, arrive, leave, walkMinutes: walk, flags: flagsFor(place, arrive, leave, pauses, periods) });
    t = leave.getTime();
    walk = legs.get(place.id)?.leg?.minutes ?? 0;
  });
  return {
    stops: out,
    finish: out.length ? out[out.length - 1].leave : null,
    flagged: out.filter(s => s.flags.length).length,
    closures: out.filter(s => s.flags.some(f => f.kind !== 'prayer')).length,
  };
}

// Closures count for more than prayer pauses: a pause is a wait, a closure isn't.
const score = (p: VisitPlan<unknown>) => p.closures * 100 + p.flagged;

/**
 * A better start time on the same Cairo day as `start`: the fewest closures,
 * then the fewest flagged stops, then the nearest to `start`. Only starts
 * between 7 am and 5 pm and not before `notBefore`; null when none does better.
 */
export function suggestStart<T extends Place>(
  places: T[],
  routeId: string,
  start: Date,
  stayMinutes: number,
  notBefore: Date,
  periods?: SpecialPeriod[],
): { start: Date; flagged: number } | null {
  // Every candidate is on the same day, so one set of prayer times covers them all.
  const pauses = pausesAround(start);
  const current = score(visitPlan(places, routeId, start, stayMinutes, pauses, periods));
  if (current === 0) return null;
  const from = cairoTime(start).minutes;
  let best: { start: Date; flagged: number; score: number; distance: number } | null = null;
  for (let m = EARLIEST_START; m <= LATEST_START; m += STEP) {
    const candidate = new Date(start.getTime() + (m - from) * MIN);
    if (candidate < notBefore) continue;
    const plan = visitPlan(places, routeId, candidate, stayMinutes, pauses, periods);
    const s = score(plan);
    const distance = Math.abs(m - from);
    if (s < current && (!best || s < best.score || (s === best.score && distance < best.distance))) {
      best = { start: candidate, flagged: plan.flagged, score: s, distance };
    }
  }
  return best && { start: best.start, flagged: best.flagged };
}

/**
 * The time at each stop that makes the walk last about as long as the route
 * says (the middle of its hours), as the nearest of STAY_OPTIONS.
 */
export function defaultStay<T extends Place>(places: T[], route: { id: string; hoursMin: number; hoursMax: number }): number {
  const plan = visitPlan(places, route.id, new Date(0), 0, []);
  if (!plan.stops.length || !(route.hoursMax > 0)) return DEFAULT_STAY;
  const walking = plan.stops.reduce((sum, s) => sum + s.walkMinutes, 0);
  const each = ((route.hoursMin + route.hoursMax) * 30 - walking) / plan.stops.length;
  return STAY_OPTIONS.reduce((best, n) => (Math.abs(n - each) < Math.abs(best - each) ? n : best), STAY_OPTIONS[0]);
}

// --- Cairo dates -------------------------------------------------------------

let wallFormat: Intl.DateTimeFormat | undefined;
const wallParts = (at: Date) => {
  wallFormat ??= new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = wallFormat.formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') };
};

/** The instant that is `minutes` past midnight, Cairo time, `addDays` after the Cairo date of `base`. */
export function cairoInstant(base: Date, addDays: number, minutes: number): Date {
  const { y, m, d } = wallParts(base);
  const wanted = Date.UTC(y, m - 1, d + addDays, 0, minutes);
  // Cairo is UTC+2 or UTC+3; start from +2 and correct by the difference.
  let t = wanted - 2 * 60 * MIN;
  for (let i = 0; i < 3; i++) {
    const w = wallParts(new Date(t));
    const diff = wanted - Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
    if (!diff) break;
    t += diff;
  }
  return new Date(t);
}

/** How many Cairo calendar days `b` is after `a`. */
export const cairoDaysBetween = (a: Date, b: Date) => Math.round((cairoInstant(b, 0, 12 * 60).getTime() - cairoInstant(a, 0, 12 * 60).getTime()) / (24 * 60 * MIN));

/** "HH:MM" for an instant, in Cairo time (for a time input). */
export const cairoHHMM = (at: Date) => {
  const { minutes } = cairoTime(at);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/** Now, rounded up to the next quarter hour. */
export const nextQuarter = (now: Date) => new Date(Math.ceil(now.getTime() / (STEP * MIN)) * STEP * MIN);
