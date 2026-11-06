import { describe, expect, it } from 'vitest';
import { BREAK_MAX_METERS, nearestBreaks } from './breaks';

const week = (open: string, close: string) => ({ days: Array.from({ length: 7 }, () => [{ open, close }]) });
// About 111 m per 0.001° of latitude.
const at = (id: number, category: string, dLat: number, extra: object = {}) => ({ id, category: category as never, lat: 30 + dLat, lng: 31.25, ...extra });
const from = { lat: 30, lng: 31.25 };
const sixPm = new Date('2026-11-06T18:00:00+02:00');

describe('nearestBreaks', () => {
  it('lists the nearest cafés and restaurants, open ones before closed ones', () => {
    const places = [
      at(1, 'coffee', 0.001, { hours: week('08:00', '12:00') }), // nearest but closed at 6 pm
      at(2, 'restaurant', 0.003, { hours: week('12:00', '23:00') }),
      at(3, 'coffee', 0.002), // no hours: maybe open
      at(4, 'monument', 0.0005),
      at(5, 'coffee', 0.004),
    ];
    const { food } = nearestBreaks(places, from, sixPm);
    expect(food.map(b => [b.place.id, b.open])).toEqual([[3, null], [2, true], [5, null]]);
    expect(food[0].meters).toBeGreaterThan(200);
    expect(food[0].minutes).toBeGreaterThan(0);
  });
  it('finds the nearest place with toilets, of any kind', () => {
    const places = [at(1, 'monument', 0.002, { tips: { toilets: true } }), at(2, 'coffee', 0.001), at(3, 'meeting', 0.0015, { tips: { toilets: false } })];
    expect(nearestBreaks(places, from, sixPm).toilets?.place.id).toBe(1);
  });
  it('leaves out places too far for a break', () => {
    const far = (BREAK_MAX_METERS + 200) / 111_000;
    const r = nearestBreaks([at(1, 'coffee', far), at(2, 'monument', far, { tips: { toilets: true } })], from, sixPm);
    expect(r).toEqual({ food: [], toilets: null });
  });
});
