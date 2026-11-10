import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { walkStops } from './walk';
import { directionsUrl, gettingThere, gettingThereFor, startPlace } from './getting-there';

const route = bundledContent.routes[0];
const places = bundledContent.places;
const [first, second] = walkStops(places, route.id);
const meeting = places.find(p => p.routeId === route.id && p.category !== 'monument');

describe('startPlace', () => {
  it('is the first stop unless the admin chose another place on the route', () => {
    expect(startPlace(route, places)).toBe(first);
    expect(startPlace({ ...route, startId: second.id }, places)).toBe(second);
    if (meeting) expect(startPlace({ ...route, startId: meeting.id }, places)).toBe(meeting);
    // A place on another route doesn't count.
    const elsewhere = places.find(p => p.routeId !== route.id)!;
    expect(startPlace({ ...route, startId: elsewhere.id }, places)).toBe(first);
  });
});

describe('gettingThere', () => {
  const withMetro = { ...route, metroEn: 'Attaba', metroAr: 'العتبة', metroMinutes: 12, gettingThereEn: 'Ask for Bab Zuweila.' };
  it('gives the metro and note in the language, falling back to English', () => {
    expect(gettingThere(withMetro, places, 'ar')).toEqual({ start: first, metro: { text: 'العتبة', lang: undefined }, minutes: 12, note: { text: 'Ask for Bab Zuweila.', lang: 'en' } });
    expect(gettingThere(withMetro, places, 'fr')?.metro).toEqual({ text: 'Attaba', lang: 'en' });
  });
  it('leaves out what is not set, and minutes without a station', () => {
    expect(gettingThere({ ...route, metroMinutes: 5 }, places, 'en')).toEqual({ start: first, metro: null, minutes: null, note: null });
  });
  it('is null for a route without places', () => {
    expect(gettingThere({ ...route, id: 'empty' }, places, 'en')).toBeNull();
  });
  it('gives directions by coordinates', () => {
    expect(directionsUrl({ lat: 30.04, lng: 31.26 })).toBe('https://www.google.com/maps/dir/?api=1&destination=30.04,31.26');
  });
});

describe('content', () => {
  it('keeps the fields, drops a start point not on the route, and checks lengths and minutes', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.routes[0], { startId: second.id, metroEn: '  Attaba ', metroMinutes: '12', gettingThereFr: '' });
    Object.assign(content.routes[1], { startId: first.id });
    const n = normalizeContent(content);
    expect(n.routes[0]).toMatchObject({ startId: second.id, metroEn: 'Attaba', metroMinutes: 12 });
    expect('gettingThereFr' in n.routes[0]).toBe(false);
    expect('startId' in n.routes[1]).toBe(false);
    expect(validateContent(n)).toEqual([]);
    n.routes[0].metroMinutes = 90;
    n.routes[0].gettingThereEn = 'x'.repeat(301);
    const problems = validateContent(n).join(' ');
    expect(problems).toContain('whole minutes, from 1 to 60');
    expect(problems).toContain('gettingThereEn is longer than 300 characters');
  });
});

describe('gettingThereFor (the short walk)', () => {
  const withMetro = { ...route, metroEn: 'Sayeda Zeinab', metroAr: 'السيدة زينب', metroMinutes: 12, gettingThereEn: 'Ask for the mosque' };
  it("is the route's own directions when the walk starts at the route's start", () => {
    const walk = places.filter(p => p.routeId !== route.id || p.id !== second.id);
    expect(gettingThereFor(withMetro, places, walk, 'en')).toEqual(gettingThere(withMetro, places, 'en'));
  });
  it("gives only the stop's name when the walk starts elsewhere", () => {
    const walk = places.filter(p => p.id !== first.id);
    expect(gettingThereFor(withMetro, places, walk, 'en')).toEqual({ start: second, metro: null, minutes: null, note: null });
    expect(gettingThere(withMetro, walk, 'en')?.metro?.text).toBe('Sayeda Zeinab');
  });
});
