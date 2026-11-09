import { describe, expect, it } from 'vitest';
import { NEARBY_MAX, NEARBY_MINUTES, nearbyOnOtherRoutes } from './nearby';
import { locations } from '../data/locations';
import { walkMinutes } from './walk';
import { distanceMeters } from './geo';

// Places along a line running east; 0.001° of longitude is about 96 m here.
const at = (id: number, routeId: string, east: number) => ({ id, routeId, lat: 30.05, lng: 31.25 + east * 0.001 });

describe('nearbyOnOtherRoutes', () => {
  const here = at(1, 'a', 0);
  const places = [here, at(2, 'a', 1), at(3, 'b', 2), at(4, 'c', 1.5), at(5, 'b', 3), at(6, 'd', 4), at(7, 'e', 12)];

  it('lists places on other routes only, nearest first, at most 3', () => {
    const near = nearbyOnOtherRoutes(here, places);
    expect(near.map(n => n.place.id)).toEqual([4, 3, 5]);
    expect(near).toHaveLength(NEARBY_MAX);
    expect(near.every(n => n.place.routeId !== 'a')).toBe(true);
  });

  it('leaves out places further than the walk limit', () => {
    const near = nearbyOnOtherRoutes(here, [here, at(7, 'e', 12)]);
    expect(near).toEqual([]);
    expect(walkMinutes(distanceMeters(here, at(7, 'e', 12)))).toBeGreaterThan(NEARBY_MINUTES);
  });

  it('gives the walking minutes', () => {
    const [first] = nearbyOnOtherRoutes(here, [here, at(3, 'b', 2)]);
    expect(first.minutes).toBe(walkMinutes(distanceMeters(here, at(3, 'b', 2))));
  });

  it('finds something near for some built-in places, and never one on the same route', () => {
    let withNearby = 0;
    for (const p of locations) {
      const near = nearbyOnOtherRoutes(p, locations);
      if (near.length) withNearby++;
      expect(near.every(n => n.place.routeId !== p.routeId && n.minutes <= NEARBY_MINUTES)).toBe(true);
    }
    expect(withNearby).toBeGreaterThan(0);
  });
});
