// Checks the content in locations.ts, so mistakes are caught before they ship:
// a typo in a route ID, a missing translation, coordinates in the wrong place.

import { describe, expect, it } from 'vitest';
import { categories, locations, routes } from './locations';

// Roughly Greater Cairo. Generous, but catches swapped lat/lng and typos.
const CAIRO = { minLat: 29.9, maxLat: 30.15, minLng: 31.1, maxLng: 31.4 };

const blank = (value: string | undefined) => !value || value.trim() === '';
const hasArabic = (value: string) => /[؀-ۿ]/.test(value);
const duplicates = <T,>(values: T[]) => values.filter((v, i) => values.indexOf(v) !== i);

describe('routes', () => {
  it('have unique IDs', () => {
    expect(duplicates(routes.map(r => r.id))).toEqual([]);
  });

  it.each(routes.map(r => [r.id, r] as const))('%s has English and Arabic text', (_, route) => {
    for (const field of ['nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'distance', 'duration'] as const) {
      expect(blank(route[field]), `${field} is empty`).toBe(false);
    }
    expect(hasArabic(route.nameAr), 'nameAr has no Arabic text').toBe(true);
    expect(hasArabic(route.descriptionAr), 'descriptionAr has no Arabic text').toBe(true);
    expect(route.highlightsEn.length, 'highlights differ in count').toBe(route.highlightsAr.length);
  });

  it('each have at least one place', () => {
    const empty = routes.filter(r => !locations.some(l => l.routeId === r.id)).map(r => r.id);
    expect(empty).toEqual([]);
  });
});

describe('categories', () => {
  it('have unique IDs', () => {
    expect(duplicates(categories.map(c => c.id))).toEqual([]);
  });
});

describe('places', () => {
  const routeIds = new Set(routes.map(r => r.id));
  const categoryIds = new Set(categories.map(c => c.id));

  it('have unique, positive whole-number IDs', () => {
    expect(duplicates(locations.map(l => l.id))).toEqual([]);
    // The API only accepts IDs like this (see api/_lib/guard.ts).
    expect(locations.filter(l => !Number.isInteger(l.id) || l.id < 1).map(l => l.id)).toEqual([]);
  });

  it.each(locations.map(l => [`${l.id} ${l.nameEn}`, l] as const))('%s is valid', (_, place) => {
    expect(routeIds.has(place.routeId), `unknown routeId "${place.routeId}"`).toBe(true);
    expect(categoryIds.has(place.category), `unknown category "${place.category}"`).toBe(true);

    expect(blank(place.nameEn), 'nameEn is empty').toBe(false);
    expect(hasArabic(place.nameAr), 'nameAr has no Arabic text').toBe(true);
    // The audio guide narrates these, so both languages need one.
    expect(blank(place.descriptionEn), 'descriptionEn is empty').toBe(false);
    expect(hasArabic(place.descriptionAr ?? ''), 'descriptionAr has no Arabic text').toBe(true);

    expect(place.lat, 'latitude outside Cairo').toBeGreaterThanOrEqual(CAIRO.minLat);
    expect(place.lat, 'latitude outside Cairo').toBeLessThanOrEqual(CAIRO.maxLat);
    expect(place.lng, 'longitude outside Cairo').toBeGreaterThanOrEqual(CAIRO.minLng);
    expect(place.lng, 'longitude outside Cairo').toBeLessThanOrEqual(CAIRO.maxLng);
  });
});
