import { afterEach, describe, expect, it } from 'vitest';
import { PACE_FACTOR, readPace } from './pace';
import { atPace, setPaceFactor, walkMinutes, walkPlan } from './walk';
import { gettingThere } from './getting-there';
import { defaultStay, visitPlan } from './visit-plan';
import { shortWalkStats } from './short-walk-core';
import { nearbyOnOtherRoutes } from './nearby';
import { bundledContent } from '../data/content';

const { places, routes } = bundledContent;
const route = routes[0];
const legMinutes = () => [...walkPlan(places, route.id).values()].reduce((n, s) => n + (s.leg?.minutes ?? 0), 0);

afterEach(() => setPaceFactor(1));

describe('readPace', () => {
  it('reads a stored pace, else the usual one', () => {
    expect(readPace('brisk')).toBe('brisk');
    expect(readPace('relaxed')).toBe('relaxed');
    expect(readPace(null)).toBe('usual');
    expect(readPace('sprint')).toBe('usual');
  });
});

describe('walking times at a pace', () => {
  it('scales each walk, still at least a minute', () => {
    expect(walkMinutes(1000)).toBe(17);
    expect(walkMinutes(1000, PACE_FACTOR.relaxed)).toBe(23);
    expect(walkMinutes(1000, PACE_FACTOR.brisk)).toBe(14);
    expect(walkMinutes(1, PACE_FACTOR.brisk)).toBe(1);
  });

  it('applies the pace set for the app to plans, the short walk and the timetable', () => {
    const usual = legMinutes();
    const short = shortWalkStats(places, route.id);
    const start = new Date('2026-11-17T07:00:00Z');
    const plan = visitPlan(places, route.id, start, 20, []);
    setPaceFactor(PACE_FACTOR.relaxed);
    expect(legMinutes()).toBeGreaterThan(usual);
    const slow = visitPlan(places, route.id, start, 20, []);
    expect(slow.finish!.getTime()).toBeGreaterThan(plan.finish!.getTime());
    // Distances stay the same.
    expect(shortWalkStats(places, route.id).meters).toBe(short.meters);
  });

  it("applies it to the admin's minutes from the metro too", () => {
    expect(atPace(10, PACE_FACTOR.relaxed)).toBe(13);
    expect(atPace(10, PACE_FACTOR.brisk)).toBe(8);
    const r = { ...route, metroEn: 'Mar Girgis station', metroMinutes: 10 };
    expect(gettingThere(r, places)?.minutes).toBe(10);
    setPaceFactor(PACE_FACTOR.relaxed);
    expect(gettingThere(r, places)?.minutes).toBe(13);
  });

  it("ignores a pace that isn't a positive number", () => {
    setPaceFactor(Number.NaN);
    expect(walkMinutes(1000)).toBe(17);
    setPaceFactor(0);
    expect(walkMinutes(1000)).toBe(17);
  });

  it('keeps the default time at each stop and which places count as nearby', () => {
    const stay = defaultStay(places, route);
    const near = nearbyOnOtherRoutes(places[0], places).map(n => n.place.id);
    setPaceFactor(PACE_FACTOR.relaxed);
    expect(defaultStay(places, route)).toBe(stay);
    expect(nearbyOnOtherRoutes(places[0], places).map(n => n.place.id)).toEqual(near);
  });
});
