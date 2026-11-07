import { describe, expect, it } from 'vitest';
import { legArrows } from './map-stops';

describe('legArrows', () => {
  it('puts one arrow at the middle of each leg, pointing to the next stop', () => {
    const arrows = legArrows([{ lat: 30, lng: 31 }, { lat: 30.01, lng: 31 }, { lat: 30.01, lng: 31.01 }]);
    expect(arrows).toHaveLength(2);
    expect(arrows[0].lat).toBeCloseTo(30.005, 6);
    expect(arrows[0].lng).toBeCloseTo(31, 6);
    expect(arrows[0].bearing).toBe(0); // due north
    expect(arrows[1].bearing).toBeGreaterThan(85); // roughly east
    expect(arrows[1].bearing).toBeLessThan(95);
  });
  it('skips legs between two stops in the same spot, and needs two stops', () => {
    expect(legArrows([{ lat: 30, lng: 31 }, { lat: 30, lng: 31 }])).toEqual([]);
    expect(legArrows([{ lat: 30, lng: 31 }])).toEqual([]);
  });
});
