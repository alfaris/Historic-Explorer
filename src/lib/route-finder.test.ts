import { describe, expect, it } from 'vitest';
import { routeProfile, suggestRoutes, timeFit } from './route-finder';

const place = (routeId: string, category: string, nameEn = 'Place', nameAr = 'مكان') => ({ routeId, category: category as never, nameEn, nameAr });
const routes = [
  { id: 'short-food', hoursMin: 1, hoursMax: 1.5 },
  { id: 'long-mosques', hoursMin: 3, hoursMax: 4 },
  { id: 'medium-crafts', hoursMin: 2, hoursMax: 3 },
];
const places = [
  ...['Al-Azhar Mosque', 'Sultan Hassan Mosque', 'Shajar al-Durr Mausoleum'].map(n => place('long-mosques', 'monument', n)),
  place('long-mosques', 'monument', 'Bayt al-Suhaymi', 'بيت السحيمي'),
  place('short-food', 'coffee'), place('short-food', 'restaurant'), place('short-food', 'coffee'),
  place('short-food', 'monument', 'Bab Zuweila', 'باب زويلة'),
  place('medium-crafts', 'workshop'), place('medium-crafts', 'stationary'), place('medium-crafts', 'coffee'),
];

describe('routeProfile', () => {
  it('counts mosques and shrines, other monuments, food and crafts', () => {
    expect(routeProfile(places, 'long-mosques')).toEqual({ mosques: 3, museums: 1, food: 0, crafts: 0 });
    expect(routeProfile(places, 'short-food')).toEqual({ mosques: 0, museums: 1, food: 3, crafts: 0 });
  });
});

describe('timeFit', () => {
  it('is 1 when the hours overlap and lower the further off', () => {
    expect(timeFit(routes[0], 'short')).toBe(1);
    expect(timeFit(routes[1], 'medium')).toBe(1);
    expect(timeFit(routes[1], 'short')).toBeLessThan(timeFit(routes[2], 'short'));
  });
});

describe('suggestRoutes', () => {
  it('suggests nothing until something is chosen', () => {
    expect(suggestRoutes(routes, places, null, [])).toEqual([]);
  });
  it('about an hour and food: the short food walk', () => {
    expect(suggestRoutes(routes, places, 'short', ['food'])[0].route.id).toBe('short-food');
  });
  it('half a day and mosques: the long mosque walk', () => {
    expect(suggestRoutes(routes, places, 'long', ['mosques'])[0].route.id).toBe('long-mosques');
  });
  it('interests alone still rank, and a close second is offered', () => {
    const s = suggestRoutes(routes, places, null, ['crafts']);
    expect(s[0].route.id).toBe('medium-crafts');
    expect(s.length).toBe(1);
    const both = suggestRoutes(routes, places, 'medium', []);
    expect(both.map(x => x.route.id)).toEqual(['long-mosques', 'medium-crafts']);
  });
  it('does not put a walk with none of the interest first just for its time', () => {
    const rs = [{ id: 'fits-time', hoursMin: 1, hoursMax: 1.5 }, { id: 'has-food', hoursMin: 2, hoursMax: 3 }];
    const ps = [place('has-food', 'coffee'), place('has-food', 'restaurant'), place('fits-time', 'monument')];
    expect(suggestRoutes(rs, ps, 'short', ['food'])[0].route.id).toBe('has-food');
  });
});
