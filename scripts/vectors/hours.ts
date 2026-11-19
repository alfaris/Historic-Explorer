// Opening hours, special hours and "open now", at instants chosen to catch the
// hard cases: ranges past midnight, the week's wrap from Saturday to Sunday,
// the exact minute a place opens or closes, and Egypt's DST changes.

import { cairoTime, openStatus, type OpeningHours } from '../../src/lib/opening-hours.js';
import { effectiveHours, openStatusAt, type SpecialPeriod } from '../../src/lib/special-hours.js';
import { routeOpenNow } from '../../src/lib/open-now.js';
import { at, iso, type VectorSet } from './common.js';

const r = (open: string, close: string) => ({ open, close });
const every = (ranges: { open: string; close: string }[]) => Array.from({ length: 7 }, () => ranges);

/** Weekly hours, Sunday first, in Cairo time. */
export const HOURS: Record<string, OpeningHours> = {
  daytime: { days: every([r('09:00', '17:00')]) },
  // A mosque: closed to visits at Friday prayers.
  fridaySplit: { days: [[r('09:00', '17:00')], [r('09:00', '17:00')], [r('09:00', '17:00')], [r('09:00', '17:00')], [r('09:00', '17:00')], [r('09:00', '11:30'), r('13:30', '17:00')], [r('09:00', '17:00')]] },
  // A café open past midnight, closed Mondays.
  pastMidnight: { days: [[r('18:00', '02:00')], [], [r('18:00', '02:00')], [r('18:00', '02:00')], [r('18:00', '02:00')], [r('18:00', '02:00')], [r('18:00', '02:00')]] },
  // Saturday night runs into Sunday morning (the week's wrap).
  saturdayLate: { days: [[], [], [], [], [], [], [r('20:00', '03:00')]] },
  // Midnight to midnight every day: open round the clock.
  allWeek: { days: every([r('00:00', '00:00')]) },
  // Two ranges that touch across midnight and merge.
  touching: { days: [[r('18:00', '00:00')], [r('00:00', '02:00'), r('18:00', '00:00')], [], [], [], [], []] },
  closed: { days: every([]) },
};

/** Instants (UTC). Cairo is UTC+2, and UTC+3 in summer (from the last Friday of April to the last Thursday of October). */
export const INSTANTS = [
  // An ordinary winter week, Sunday 2026-01-04 to Saturday 2026-01-10, at telling times.
  '2026-01-04T06:59Z', '2026-01-04T07:00Z', '2026-01-04T14:59Z', '2026-01-04T15:00Z', // 08:59, 09:00, 16:59, 17:00 Cairo
  '2026-01-04T22:30Z', '2026-01-05T00:30Z', '2026-01-05T16:00Z', '2026-01-05T23:59Z',
  '2026-01-09T09:29Z', '2026-01-09T09:30Z', '2026-01-09T11:30Z', '2026-01-09T11:31Z', // Friday 11:29 … 13:31
  '2026-01-10T17:59Z', '2026-01-10T18:00Z', '2026-01-10T23:00Z', '2026-01-11T00:59Z', '2026-01-11T01:00Z', // Saturday night into Sunday
  // A summer weekday (UTC+3).
  '2026-07-15T05:59Z', '2026-07-15T06:00Z', '2026-07-15T13:59Z', '2026-07-15T14:00Z', '2026-07-15T22:59Z',
  // DST starts: Friday 2026-04-24, 00:00 Cairo becomes 01:00.
  '2026-04-23T21:30Z', '2026-04-23T21:59Z', '2026-04-23T22:00Z', '2026-04-23T22:30Z', '2026-04-23T23:00Z', '2026-04-24T06:00Z',
  // DST ends: Thursday 2026-10-29, 24:00 Cairo becomes 23:00 again.
  '2026-10-29T19:30Z', '2026-10-29T20:59Z', '2026-10-29T21:00Z', '2026-10-29T21:30Z', '2026-10-29T22:00Z', '2026-10-29T22:30Z', '2026-10-30T06:00Z',
];

/** Special periods for place 1 (and 2 for "may differ"). */
export const PERIODS: SpecialPeriod[] = [
  { id: 'ramadan-2027', nameEn: 'Ramadan', nameAr: 'رمضان', from: '2027-02-08', to: '2027-03-09', places: { '1': { days: every([r('10:00', '15:00'), r('20:00', '01:00')]) } } },
  { id: 'eid-2027', nameEn: 'Eid', nameAr: 'العيد', from: '2027-03-10', to: '2027-03-12', places: { '1': { closed: true } } },
  { id: 'works', nameEn: 'Works', nameAr: 'صيانة', from: '2027-05-01', to: '2027-05-01', places: { '3': { closed: true } } },
];

export const PERIOD_INSTANTS = [
  '2027-02-07T12:00Z', '2027-02-07T22:30Z', // the day before Ramadan; a late evening with Ramadan starting tomorrow
  '2027-02-08T07:59Z', '2027-02-08T08:00Z', '2027-02-08T13:00Z', '2027-02-08T18:00Z', '2027-02-08T22:30Z', '2027-02-08T23:30Z',
  '2027-03-09T22:30Z', '2027-03-10T09:00Z', '2027-03-12T21:59Z', '2027-03-12T22:00Z', '2027-03-13T09:00Z', '2027-05-01T09:00Z',
];

export const hoursVectors: VectorSet = {
  name: 'opening-hours',
  build: () => ({
    about:
      'Whether a place is open at an instant, and when that changes (openStatus in src/lib/opening-hours.ts). Hours are weekly, Sunday first, in Cairo time; ' +
      'instants are UTC. `cairo` is the Cairo weekday (0 = Sunday) and minutes since midnight at that instant. A status is {open, closes} or {open, opens}, ' +
      'where a change is {inDays, minutes}: days from the Cairo date of the instant, and minutes since that day\'s midnight; null means no change in sight.',
    hours: HOURS,
    cases: INSTANTS.flatMap(instant => [
      { at: instant, cairo: cairoTime(at(instant)) },
      ...Object.keys(HOURS).map(name => ({ hours: name, at: instant, status: openStatus(HOURS[name], at(instant)) })),
    ]),
  }),
};

const PLACES = [
  { id: 1, hours: HOURS.daytime },
  { id: 2, hours: HOURS.pastMidnight },
  { id: 3, hours: HOURS.fridaySplit },
  { id: 4 }, // no usual hours
];

export const specialHoursVectors: VectorSet = {
  name: 'special-hours',
  build: () => ({
    about:
      'Hours with special periods (Ramadan, Eid, one-off closures) in force (openStatusAt and effectiveHours in src/lib/special-hours.ts). ' +
      'Each period lists places by ID with their own weekly hours or {closed: true}; the first listed period wins. Statuses are as in opening-hours.json; ' +
      'null means nothing is known. `effective` is the week from the instant\'s Cairo date as weekly hours, the ID of the period in force today, ' +
      'whether today is a special closure, and the ID of a period on today that doesn\'t list the place.',
    places: PLACES,
    periods: PERIODS,
    cases: PERIOD_INSTANTS.flatMap(instant =>
      PLACES.map(place => {
        const e = effectiveHours(place, at(instant), PERIODS);
        return {
          place: place.id,
          at: instant,
          status: openStatusAt(place, at(instant), PERIODS),
          effective: { days: e.hours?.days ?? null, period: e.period?.id ?? null, closedToday: e.closedToday, mayDiffer: e.mayDiffer?.id ?? null },
        };
      }),
    ),
  }),
};

export const openNowVectors: VectorSet = {
  name: 'open-now',
  build: () => ({
    about:
      'A route\'s "open now" summary (routeOpenNow in src/lib/open-now.ts): of its stops, how many have known hours, how many are open, and how many of those ' +
      'close within the hour. Stops are the places of special-hours.json, with its periods.',
    places: PLACES,
    periods: PERIODS,
    cases: [...INSTANTS.slice(0, 17), ...PERIOD_INSTANTS].map(instant => ({
      at: instant,
      withoutPeriods: routeOpenNow(PLACES, at(instant), undefined),
      withPeriods: routeOpenNow(PLACES, at(instant), PERIODS),
    })),
  }),
};

export { iso };
