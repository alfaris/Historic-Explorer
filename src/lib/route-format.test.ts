import { describe, expect, it } from 'vitest';
import { formatDistance, formatDuration, parseDistanceKm, parseHours, routeText } from './route-format';

describe('reading old text', () => {
  it.each([['2.5 km', 2.5], ['1.0 km', 1], ['7 km', 7], ['800 m', 0.8], ['2,5 km', 2.5], ['about', NaN], ['', NaN]])('%s → %s km', (text, km) => {
    expect(parseDistanceKm(text)).toBe(km);
  });
  it.each<[string, [number, number] | null]>([
    ['2-3 hours', [2, 3]],
    ['1.5-2 hours', [1.5, 2]],
    ['3.5–4.5 hours', [3.5, 4.5]],
    ['3 hours', [3, 3]],
    ['1 hour', [1, 1]],
    ['45 min', [0.75, 0.75]],
    ['2 to 3 hours', [2, 3]],
    ['half a day', null],
  ])('%s → %j', (text, hours) => {
    expect(parseHours(text)).toEqual(hours);
  });
});

describe('formatting', () => {
  it('writes distance in each language', () => {
    expect(formatDistance(2.5, 'en')).toBe('2.5 km');
    expect(formatDistance(2.5, 'fr')).toBe('2,5 km');
    expect(formatDistance(2.5, 'ar')).toBe('2.5 كم');
    expect(formatDistance(1, 'en')).toBe('1 km');
  });
  it('writes walking time in each language', () => {
    expect(formatDuration(2, 3, 'en')).toBe('2-3 hours');
    expect(formatDuration(1, 1, 'en')).toBe('1 hour');
    expect(formatDuration(2, 3, 'fr')).toBe('2 à 3 heures');
    expect(formatDuration(1.5, 2, 'fr')).toBe('1,5 à 2 heures');
    expect(formatDuration(1, 1, 'fr')).toBe('1 heure');
    expect(formatDuration(2, 3, 'ar')).toBe('2–3 ساعات');
    expect(formatDuration(1.5, 2, 'ar')).toBe('1.5–2 ساعة');
    expect(formatDuration(3.5, 4.5, 'ar')).toBe('3.5–4.5 ساعة');
    expect(formatDuration(1, 1, 'ar')).toBe('ساعة واحدة');
    expect(formatDuration(2, 2, 'ar')).toBe('ساعتان');
  });
  it('makes the English text kept for older app versions', () => {
    expect(routeText({ distanceKm: 2.5, hoursMin: 2, hoursMax: 3 })).toEqual({ distance: '2.5 km', duration: '2-3 hours' });
    expect(routeText({ distanceKm: NaN, hoursMin: NaN, hoursMax: NaN })).toEqual({ distance: '', duration: '' });
  });
});

describe('Spanish', () => {
  it('writes distance and walking time in Spanish', () => {
    expect(formatDistance(2.5, 'es')).toBe('2,5 km');
    expect(formatDuration(2, 3, 'es')).toBe('2 a 3 horas');
    expect(formatDuration(1.5, 2, 'es')).toBe('1,5 a 2 horas');
    expect(formatDuration(1, 1, 'es')).toBe('1 hora');
    expect(formatDuration(3, 3, 'es')).toBe('3 horas');
  });
});
