import { describe, expect, it } from 'vitest';
import { locations } from '../data/locations';
import { matchScore, normalizeForSearch, searchPlaces } from './search';

const names = (q: string) => searchPlaces(locations, q).map(p => p.nameEn);

describe('normalizeForSearch', () => {
  it('folds Arabic letter variants, vowel marks and tatweel', () => {
    expect(normalizeForSearch('السيّدة نفيسة')).toBe(normalizeForSearch('السيده نفيسه'));
    expect(normalizeForSearch('أحمد')).toBe('احمد');
    expect(normalizeForSearch('مـسـجد')).toBe('مسجد');
    expect(normalizeForSearch('مستشفى')).toBe('مستشفي');
  });

  it('folds English case, accents, hyphens and apostrophes', () => {
    expect(normalizeForSearch("Al-Rifa'i")).toBe('alrifai');
    expect(normalizeForSearch('Café  CORNER')).toBe('cafe corner');
  });
});

describe('searchPlaces', () => {
  it('finds places in every route', () => {
    const results = searchPlaces(locations, 'mosque');
    expect(new Set(results.map(p => p.routeId)).size).toBeGreaterThan(2);
  });

  it('forgives punctuation and spelling of "al-"', () => {
    expect(names('rifai')).toContain("Al-Rifa'i Mosque");
    expect(names('al rifai')).toContain("Al-Rifa'i Mosque");
  });

  it('matches Arabic without hamza or vowel marks', () => {
    expect(names('جامع احمد بن طولون')).toContain('Ahmad Ibn Tulun Mosque');
    expect(names('السيده نفيسه')).toEqual(expect.arrayContaining(['Al-Sayyida Nafisa Mosque', 'Sayyida Nafisa Square']));
  });

  it('needs every word of the query', () => {
    expect(names('nafisa square')).toEqual(['Sayyida Nafisa Square']);
    expect(names('nafisa xyz')).toEqual([]);
  });

  it('puts names that start with the query first', () => {
    const results = names('bab');
    expect(results[0]).toMatch(/^Bab /);
  });

  it('matches nothing for an empty query', () => {
    expect(searchPlaces(locations, '   ')).toEqual([]);
    expect(matchScore(locations[0], '')).toBe(0);
  });
});
