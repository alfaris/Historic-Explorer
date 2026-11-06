import { describe, expect, it } from 'vitest';
import type { Location } from '../data/locations';
import { cairoTime } from './opening-hours';
import { cairoDaysBetween, cairoHHMM, cairoInstant, defaultStay, nextQuarter, suggestStart, visitPlan } from './visit-plan';

// Cairo is UTC+2 in winter. 2026-01-05 was a Monday; 2026-01-09 a Friday.
const cairo = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, m));
};

const nineToFive = { days: Array.from({ length: 7 }, () => [{ open: '09:00', close: '17:00' }]) };
const place = (id: number, lat: number, extra: object = {}) => ({
  id, routeId: 'r', category: 'monument', lat, lng: 31.26, nameEn: `Place ${id}`, nameAr: `مكان ${id}`, ...extra,
}) as Location;
// About 445 m apart in a line: 8 minutes' walk each (× 1.3 detour at 75 m/min).
const places = [
  place(1, 30.040, { hours: nineToFive }),
  place(2, 30.044, { hours: nineToFive }),
  place(3, 30.048, { hours: nineToFive }),
  { ...place(9, 30.046), category: 'coffee' } as Location, // not a stop
];

describe('visitPlan', () => {
  it('times each stop from the walk and the time spent at each', () => {
    const plan = visitPlan(places, 'r', cairo('2026-01-05', '10:00'), 20);
    expect(plan.stops.map(s => s.place.id)).toEqual([1, 2, 3]);
    expect(plan.stops.map(s => cairoHHMM(s.arrive))).toEqual(['10:00', '10:28', '10:56']);
    expect(plan.stops[1].walkMinutes).toBe(8);
    expect(cairoHHMM(plan.finish!)).toBe('11:16');
    expect(plan.flagged).toBe(0);
  });

  it('flags stops that close during the visit or are closed on arrival, for a 4 pm start', () => {
    const plan = visitPlan(places, 'r', cairo('2026-01-05', '16:00'), 30);
    // 16:00–16:30 fine; 16:38–17:08 closes at 5 pm; 17:16 closed.
    expect(plan.stops.map(s => s.flags.map(f => f.kind))).toEqual([[], ['closing'], ['closed']]);
    expect(plan.flagged).toBe(2);
  });

  it('flags a visit that runs into a midday break, even though it reopens before the visit ends', () => {
    const split = { days: Array.from({ length: 7 }, () => [{ open: '09:00', close: '12:00' }, { open: '12:15', close: '17:00' }]) };
    const plan = visitPlan([place(1, 30.04, { hours: split })], 'r', cairo('2026-01-05', '11:45'), 45);
    expect(plan.stops[0].flags.map(f => f.kind)).toEqual(['closing']);
    expect(visitPlan([place(1, 30.04, { hours: split })], 'r', cairo('2026-01-05', '12:15'), 45).flagged).toBe(0);
  });

  it('uses special hours on the planned day', () => {
    // A one-day closure of stop 2 on Monday 5 January.
    const periods = [{ id: 'closure', nameEn: 'Closure', nameAr: 'إغلاق', from: '2026-01-05', to: '2026-01-05', places: { '2': { closed: true as const } } }];
    const plan = visitPlan(places, 'r', cairo('2026-01-05', '10:00'), 20, undefined, periods);
    expect(plan.stops.map(s => s.flags.map(f => f.kind))).toEqual([[], ['closed'], []]);
    // The next day, usual hours again.
    expect(visitPlan(places, 'r', cairo('2026-01-06', '10:00'), 20, undefined, periods).flagged).toBe(0);
  });

  it('does not flag places without hours', () => {
    const plan = visitPlan(places.map(p => ({ ...p, hours: undefined })), 'r', cairo('2026-01-05', '23:00'));
    expect(plan.flagged).toBe(0);
  });

  it('flags the Friday prayer at mosques, and only at mosques', () => {
    const mosques = [
      place(1, 30.040, { nameEn: 'Al-Azhar Mosque' }),
      place(2, 30.044, { nameEn: 'Wikala', mosque: false }),
    ];
    const plan = visitPlan(mosques, 'r', cairo('2026-01-09', '11:40'), 30);
    const flag = plan.stops[0].flags[0];
    expect(flag.kind).toBe('prayer');
    expect(flag.kind === 'prayer' && flag.pause.name).toBe('jumuah');
    expect(plan.stops[1].flags).toEqual([]);
  });

  it('is empty for a route with no stops', () => {
    expect(visitPlan(places, 'none', cairo('2026-01-05', '10:00'))).toEqual({ stops: [], finish: null, flagged: 0, closures: 0 });
  });
});

describe('suggestStart', () => {
  it('suggests the nearest start that avoids the closures', () => {
    const s = suggestStart(places, 'r', cairo('2026-01-05', '16:00'), 30, cairo('2026-01-05', '08:00'));
    // The walk takes 1 h 46 min, so it must start by 15:14; 15:00 is the nearest quarter hour.
    expect(cairoHHMM(s!.start)).toBe('15:00');
    expect(s!.flagged).toBe(0);
  });
  it('never suggests a time in the past', () => {
    const s = suggestStart(places, 'r', cairo('2026-01-05', '16:00'), 30, cairo('2026-01-05', '15:50'));
    expect(s).toBeNull();
  });
  it('prefers fewer closures over fewer prayer pauses, and only daytime starts', () => {
    const mixed = [place(1, 30.040, { hours: nineToFive }), place(2, 30.044, { nameEn: 'Al-Azhar Mosque' })];
    // Friday 16:45: stop 1 closes during the visit, and the mosque visit runs into Maghrib.
    const s = suggestStart(mixed, 'r', cairo('2026-01-09', '16:45'), 30, cairo('2026-01-09', '07:00'));
    const plan = visitPlan(mixed, 'r', s!.start, 30);
    expect(plan.closures).toBe(0);
    expect(cairoTime(s!.start).minutes).toBeLessThanOrEqual(17 * 60);
  });
  it('suggests nothing when the plan is already clear', () => {
    expect(suggestStart(places, 'r', cairo('2026-01-05', '10:00'), 20, cairo('2026-01-05', '08:00'))).toBeNull();
  });
});

describe('defaultStay', () => {
  it('fits the walk to the route’s hours', () => {
    // 3 stops, 16 min walking; 1–1.5 h → (75 − 16) / 3 ≈ 20 min each.
    expect(defaultStay(places, { id: 'r', hoursMin: 1, hoursMax: 1.5 })).toBe(20);
    // A short route with many stops gets the shortest option.
    expect(defaultStay(places, { id: 'r', hoursMin: 0.25, hoursMax: 0.5 })).toBe(5);
  });
  it('falls back to 20 minutes for a route with no stops or no hours', () => {
    expect(defaultStay(places, { id: 'none', hoursMin: 2, hoursMax: 3 })).toBe(20);
    expect(defaultStay(places, { id: 'r', hoursMin: 0, hoursMax: 0 })).toBe(20);
  });
});

describe('Cairo dates', () => {
  it('counts Cairo calendar days between two instants', () => {
    expect(cairoDaysBetween(cairo('2026-01-05', '23:00'), cairo('2026-01-06', '00:30'))).toBe(1);
    expect(cairoDaysBetween(cairo('2026-01-05', '09:00'), cairo('2026-01-05', '23:59'))).toBe(0);
  });
  it('turns a Cairo day and time into an instant, in winter and summer time', () => {
    const base = cairo('2026-01-05', '22:30');
    expect(cairoInstant(base, 0, 9 * 60).toISOString()).toBe('2026-01-05T07:00:00.000Z');
    expect(cairoInstant(base, 1, 9 * 60).toISOString()).toBe('2026-01-06T07:00:00.000Z');
    // July: UTC+3.
    expect(cairoInstant(new Date(Date.UTC(2026, 6, 6, 7)), 0, 9 * 60).toISOString()).toBe('2026-07-06T06:00:00.000Z');
    expect(cairoTime(cairoInstant(base, 2, 15 * 60 + 45)).minutes).toBe(15 * 60 + 45);
  });
  it('uses the Cairo date just after midnight', () => {
    // 00:30 Cairo on 6 Jan is still 5 Jan in UTC.
    expect(cairoInstant(cairo('2026-01-06', '00:30'), 0, 9 * 60).toISOString()).toBe('2026-01-06T07:00:00.000Z');
  });
  it('rounds up to the next quarter hour', () => {
    expect(cairoHHMM(nextQuarter(cairo('2026-01-05', '10:01')))).toBe('10:15');
    expect(cairoHHMM(nextQuarter(cairo('2026-01-05', '10:15')))).toBe('10:15');
  });
});
