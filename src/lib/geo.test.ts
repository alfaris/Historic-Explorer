import { describe, expect, it } from 'vitest';
import { ARRIVE_METERS, LEAVE_METERS, distanceMeters, formatDistance, nearest, updateArrival } from './geo';

// Offsetting latitude by this many degrees moves ~1 m north.
const M = 1 / 111_195;
const ibnTulun = { id: 1, lat: 30.0287, lng: 31.2495 };
const gayer = { id: 3, lat: 30.0287 + 200 * M, lng: 31.2495 };
const places = [ibnTulun, gayer];
const at = (metersNorth: number, accuracy = 10) => ({ lat: ibnTulun.lat + metersNorth * M, lng: ibnTulun.lng, accuracy });

describe('distanceMeters', () => {
  it('is zero for the same point', () => expect(distanceMeters(ibnTulun, ibnTulun)).toBe(0));
  it('measures short distances to within a metre', () => expect(distanceMeters(ibnTulun, gayer)).toBeCloseTo(200, 0));
  it('measures long distances (Cairo to Alexandria ≈ 180 km)', () => {
    const km = distanceMeters({ lat: 30.0444, lng: 31.2357 }, { lat: 31.2001, lng: 29.9187 }) / 1000;
    expect(km).toBeGreaterThan(175);
    expect(km).toBeLessThan(185);
  });
});

describe('nearest', () => {
  it('returns null for no places', () => expect(nearest(ibnTulun, [])).toBeNull());
  it('picks the closest place', () => expect(nearest(at(150), places)?.place.id).toBe(3));
});

describe('updateArrival', () => {
  it('arrives within ARRIVE_METERS and prompts once', () => {
    const first = updateArrival({ atId: null }, at(ARRIVE_METERS - 5), places);
    expect(first.arrivedId).toBe(1);
    const again = updateArrival(first.state, at(10), places);
    expect(again.arrivedId).toBeNull();
    expect(again.state.atId).toBe(1);
  });

  it('does not arrive just outside the radius', () => {
    expect(updateArrival({ atId: null }, at(ARRIVE_METERS + 5), places).arrivedId).toBeNull();
  });

  it('ignores imprecise fixes', () => {
    expect(updateArrival({ atId: null }, at(0, 80), places).arrivedId).toBeNull();
  });

  it('does not re-prompt from GPS jitter between the two radii', () => {
    let s = updateArrival({ atId: null }, at(20), places).state;
    for (const d of [35, 45, 25, 55, 15]) {
      const r = updateArrival(s, at(d), places);
      expect(r.arrivedId).toBeNull();
      s = r.state;
    }
  });

  it('prompts again after leaving and coming back', () => {
    let s = updateArrival({ atId: null }, at(10), places).state;
    s = updateArrival(s, at(LEAVE_METERS + 20), places).state;
    expect(s.atId).toBeNull();
    expect(updateArrival(s, at(10), places).arrivedId).toBe(1);
  });

  it('moving straight to another place prompts for it', () => {
    const s = updateArrival({ atId: null }, at(5), places).state;
    expect(updateArrival(s, at(195), places).arrivedId).toBe(3);
  });
});

describe('formatDistance', () => {
  it.each([
    [3, false, '5 m'],
    [42, false, '40 m'],
    [999, false, '1.0 km'],
    [1234, false, '1.2 km'],
    [15_500, false, '16 km'],
    [42, true, '40 م'],
    [1234, true, '1.2 كم'],
  ])('%d m (arabic=%s) → %s', (m, ar, out) => expect(formatDistance(m, ar)).toBe(out));
});
