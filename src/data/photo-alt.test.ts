import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from './content';
import { photoAltOf } from './photo-resolve';

const place = { ...bundledContent.places[0], photoAltEn: 'The open courtyard and spiral minaret.', photoAltAr: 'الصحن المكشوف والمئذنة الملوية.' };

describe('photoAltOf', () => {
  it("is the description in the visitor's language, or else the name", () => {
    expect(photoAltOf(place, 'en')).toBe('The open courtyard and spiral minaret.');
    expect(photoAltOf(place, 'ar')).toBe('الصحن المكشوف والمئذنة الملوية.');
    // No French description: the (French or English) name, not English text.
    expect(photoAltOf(place, 'fr')).toBe(place.nameFr ?? place.nameEn);
    expect(photoAltOf({ ...place, photoAltEn: '  ' }, 'en')).toBe(place.nameEn);
  });
});

describe('photo descriptions in the content', () => {
  it('are kept for places and routes, trimmed', () => {
    const c = structuredClone(bundledContent);
    Object.assign(c.places[0], { photoAltEn: '  A courtyard.  ', photoAltEs: '' });
    Object.assign(c.routes[0], { photoAltFr: 'Une rue.' });
    const n = normalizeContent(c);
    expect(n.places[0].photoAltEn).toBe('A courtyard.');
    expect('photoAltEs' in n.places[0]).toBe(false);
    expect(n.routes[0].photoAltFr).toBe('Une rue.');
  });
  it('are limited in length', () => {
    const c = normalizeContent(structuredClone(bundledContent));
    c.places[0].photoAltAr = 'ب'.repeat(251);
    expect(validateContent(c).join(' ')).toContain('photoAltAr (photo description) is longer than 250 characters');
    c.places[0].photoAltAr = 'ب'.repeat(250);
    expect(validateContent(c)).toEqual([]);
  });
});
