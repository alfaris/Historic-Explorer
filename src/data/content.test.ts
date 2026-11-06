import { describe, expect, it } from 'vitest';
import { bundledContent, nextPlaceId, normalizeContent, validateContent, withMaxPlaceId, type Content } from './content';

const clone = (): Content => structuredClone(bundledContent);

describe('validateContent', () => {
  it('accepts the bundled content', () => {
    expect(validateContent(normalizeContent(bundledContent))).toEqual([]);
  });

  it.each<[string, (c: Content) => void, RegExp]>([
    ['unknown route', c => { c.places[0].routeId = 'nope'; }, /route "nope" doesn't exist/],
    ['bad category', c => { (c.places[0] as any).category = 'zoo'; }, /category "zoo"/],
    ['missing Arabic name', c => { c.places[0].nameAr = 'Ibn Tulun'; }, /Arabic name is missing/],
    ['empty description', c => { c.places[0].descriptionEn = ''; }, /English description is empty/],
    ['swapped coordinates', c => { const p = c.places[0]; [p.lat, p.lng] = [p.lng, p.lat]; }, /outside Cairo/],
    ['duplicate coordinates', c => { c.places[1].lat = c.places[0].lat; c.places[1].lng = c.places[0].lng; }, /same coordinates/],
    ['duplicate place ID', c => { c.places[1].id = c.places[0].id; }, /used twice/],
    ['bad route ID', c => { c.routes[0].id = 'Has Spaces'; c.places.forEach(p => { if (p.routeId === 'ahl-al-bayt') p.routeId = 'Has Spaces'; }); }, /lowercase letters/],
    ['highlight count mismatch', c => { c.routes[0].highlightsAr.pop(); }, /same number of lines/],
    ['too long', c => { c.places[0].descriptionEn = 'x'.repeat(2001); }, /longer than 2000/],
    ['no routes', c => { c.routes = []; c.places = []; }, /at least one route/],
    ['missing distance', c => { (c.routes[0] as any).distanceKm = null; (c.routes[0] as any).distance = ''; }, /distance must be/],
    ['walking time backwards', c => { c.routes[0].hoursMin = 4; c.routes[0].hoursMax = 2; }, /walking time must be/],
    ['walking time zero', c => { c.routes[0].hoursMin = 0; }, /walking time must be/],
    ['overlapping opening hours', c => { c.places[0].hours = { days: Array.from({ length: 7 }, () => [{ open: '09:00', close: '13:00' }, { open: '12:00', close: '17:00' }]) }; }, /time ranges overlap/],
    ['bad opening time', c => { c.places[0].hours = { days: Array.from({ length: 7 }, () => [{ open: '9am', close: '17:00' }]) }; }, /HH:MM/],
    ['fee too long', c => { c.places[0].feeEn = 'x'.repeat(121); }, /feeEn is longer than 120/],
    ['French place description too long', c => { c.places[0].descriptionFr = 'x'.repeat(2001); }, /descriptionFr is longer than 2000/],
    ['French route name too long', c => { c.routes[0].nameFr = 'x'.repeat(121); }, /nameFr is longer than 120/],
    ['too many French highlights', c => { c.routes[0].highlightsFr = Array(9).fill('x'); }, /at most 8 French highlights/],
  ])('rejects %s', (_, mutate, message) => {
    const c = clone();
    mutate(c);
    expect(validateContent(normalizeContent(c)).join('\n')).toMatch(message);
  });
});

describe('normalizeContent', () => {
  it('drops unknown fields and trims text', () => {
    const c = normalizeContent({
      routes: [{ ...bundledContent.routes[0], evil: '<script>', nameEn: '  Padded  ' }],
      places: [{ ...bundledContent.places[0], extra: 1, lat: '30.03' }],
    });
    expect(c.routes[0]).not.toHaveProperty('evil');
    expect(c.routes[0].nameEn).toBe('Padded');
    expect(c.places[0]).not.toHaveProperty('extra');
    expect(c.places[0].lat).toBe(30.03);
  });

  it('keeps French fields, and leaves empty ones out', () => {
    const c = normalizeContent({
      routes: [{ ...bundledContent.routes[0], nameFr: ' Parcours ', descriptionFr: '', highlightsFr: [' Un ', ''] }],
      places: [{ ...bundledContent.places[0], nameFr: 'Mosquée', descriptionFr: '   ' }],
    });
    expect(c.routes[0].nameFr).toBe('Parcours');
    expect(c.routes[0]).not.toHaveProperty('descriptionFr');
    expect(c.routes[0].highlightsFr).toEqual(['Un']);
    expect(c.places[0].nameFr).toBe('Mosquée');
    expect(c.places[0]).not.toHaveProperty('descriptionFr');
    const none = normalizeContent({ routes: [{ ...bundledContent.routes[0], nameFr: undefined, descriptionFr: undefined, highlightsFr: [] }], places: [] });
    expect(none.routes[0]).not.toHaveProperty('highlightsFr');
    expect(none.routes[0]).not.toHaveProperty('nameFr');
  });

  it('reads old text distance and walking time as numbers, and keeps the English text', () => {
    const { distanceKm, hoursMin, hoursMax, ...old } = bundledContent.routes[0];
    const c = normalizeContent({ routes: [{ ...old, distance: '1.8 km', duration: '1.5-2 hours' }], places: [] });
    expect(c.routes[0]).toMatchObject({ distanceKm: 1.8, hoursMin: 1.5, hoursMax: 2, distance: '1.8 km', duration: '1.5-2 hours' });
  });

  it('prefers the numbers and rewrites the English text from them', () => {
    const c = normalizeContent({ routes: [{ ...bundledContent.routes[0], distanceKm: '3', hoursMin: 1, hoursMax: 1, distance: 'stale', duration: 'stale' }], places: [] });
    expect(c.routes[0]).toMatchObject({ distanceKm: 3, hoursMin: 1, hoursMax: 1, distance: '3 km', duration: '1 hour' });
  });

  it('keeps the bundled routes as they are', () => {
    for (const r of bundledContent.routes) {
      const n = normalizeContent({ routes: [r], places: [] }).routes[0];
      expect([n.distanceKm, n.hoursMin, n.hoursMax, n.distance, n.duration]).toEqual([r.distanceKm, r.hoursMin, r.hoursMax, r.distance, r.duration]);
    }
  });

  it('keeps opening hours and fees, and leaves empty ones out', () => {
    const days = Array.from({ length: 7 }, (_, i) => (i === 5 ? [] : [{ open: '09:00', close: '17:00' }]));
    const c = normalizeContent({ routes: [bundledContent.routes[0]], places: [{ ...bundledContent.places[0], hours: { days, noteEn: ' Closed Fridays ' }, feeEn: ' EGP 60 ', feeFr: '' }] });
    expect(c.places[0].hours).toEqual({ days, noteEn: 'Closed Fridays' });
    expect(c.places[0].feeEn).toBe('EGP 60');
    expect(c.places[0]).not.toHaveProperty('feeFr');
    expect(validateContent({ ...c, places: [{ ...c.places[0], routeId: c.routes[0].id }] }).filter(p => /hours|fee/.test(p))).toEqual([]);
    const none = normalizeContent({ routes: [], places: [{ ...bundledContent.places[0], hours: { days: 'every day' } }] });
    expect(none.places[0]).not.toHaveProperty('hours');
  });

  it('copes with garbage', () => {
    expect(normalizeContent(null)).toEqual({ routes: [], places: [] });
    expect(normalizeContent({ routes: 'x', places: 5 })).toEqual({ routes: [], places: [] });
  });
});

describe('nextPlaceId', () => {
  it('is one more than the highest ID', () => {
    expect(nextPlaceId(bundledContent)).toBe(Math.max(...bundledContent.places.map(p => p.id)) + 1);
  });

  it('never reuses the ID of a deleted place', () => {
    const top = Math.max(...bundledContent.places.map(p => p.id));
    const before = withMaxPlaceId(bundledContent);
    const afterDelete = withMaxPlaceId({ ...before, places: before.places.filter(p => p.id !== top) }, before);
    expect(afterDelete.maxPlaceId).toBe(top);
    expect(nextPlaceId(normalizeContent(JSON.parse(JSON.stringify(afterDelete))))).toBe(top + 1);
  });
});

describe('photos on places and routes', () => {
  const upload = { src: `/api/photo?id=${'a'.repeat(64)}`, width: 960, height: 640, author: 'Ahmed', license: 'Own photo', licenseUrl: null, sourceUrl: '' };

  it('accepts an uploaded photo with a credit, and keeps it through normalizing', () => {
    const c = clone();
    c.places[0].photo = upload;
    c.routes[0].photo = { ...upload, license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' };
    const n = normalizeContent(c);
    expect(n.places[0].photo).toEqual(upload);
    expect(validateContent(n)).toEqual([]);
  });

  it.each<[string, Partial<typeof upload>, RegExp]>([
    ['an outside address', { src: 'https://evil.example/x.jpg' }, /isn't one of the app's photos/],
    ['a script address', { src: 'javascript:alert(1)' }, /isn't one of the app's photos/],
    ['no author', { author: '' }, /author\) is required/],
    ['no license', { license: '' }, /license is required/],
    ['a bad size', { width: 0 }, /size is invalid/],
    ['a non-https link', { sourceUrl: 'http://example.com' }, /https:\/\//],
  ])('rejects %s', (_, change, message) => {
    const c = clone();
    c.places[0].photo = { ...upload, ...change };
    expect(validateContent(normalizeContent(c)).join('\n')).toMatch(message);
  });
});

describe('Spanish content', () => {
  it('keeps Spanish fields, leaves empty ones out, and checks their length', () => {
    const c = normalizeContent({
      routes: [{ ...bundledContent.routes[0], nameEs: ' Ruta ', descriptionEs: '', highlightsEs: [' Uno ', ''] }],
      places: [{ ...bundledContent.places[0], nameEs: 'Mezquita', descriptionEs: '  ', feeEs: '60 EGP' }],
    });
    expect(c.routes[0]).toMatchObject({ nameEs: 'Ruta', highlightsEs: ['Uno'] });
    expect(c.routes[0]).not.toHaveProperty('descriptionEs');
    expect(c.places[0]).toMatchObject({ nameEs: 'Mezquita', feeEs: '60 EGP' });
    expect(c.places[0]).not.toHaveProperty('descriptionEs');
    const long = structuredClone(bundledContent);
    long.places[0].descriptionEs = 'x'.repeat(2001);
    long.routes[0].highlightsEs = Array(9).fill('x');
    const problems = validateContent(normalizeContent(long)).join('\n');
    expect(problems).toMatch(/descriptionEs is longer than 2000/);
    expect(problems).toMatch(/at most 8 Spanish highlights/);
  });
  it('the bundled routes and categories have Spanish', () => {
    for (const r of bundledContent.routes) expect(r.nameEs && r.descriptionEs && r.highlightsEs?.length).toBeTruthy();
  });
});
