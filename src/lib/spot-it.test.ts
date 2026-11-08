import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { walkStops } from './walk';
import { spotCount, spotOf } from './spot-it';

const route = bundledContent.routes[0];
const [a, b, c] = walkStops(bundledContent.places, route.id);
const withSpot = { ...a, spotEn: 'Find the spiral minaret. How many turns?', spotAnswerEn: 'Two and a half.', spotAr: 'ابحث عن المئذنة الملوية.' };

describe('spotOf', () => {
  it('gives the challenge in the language, falling back to English', () => {
    expect(spotOf(withSpot, 'en')).toEqual({ question: { text: withSpot.spotEn, lang: undefined }, answer: { text: 'Two and a half.', lang: undefined } });
    // Arabic question, no Arabic answer: the English one, marked as English.
    expect(spotOf(withSpot, 'ar')).toEqual({ question: { text: withSpot.spotAr, lang: undefined }, answer: { text: 'Two and a half.', lang: 'en' } });
    expect(spotOf(withSpot, 'fr')?.question).toEqual({ text: withSpot.spotEn, lang: 'en' });
  });
  it('is null without a challenge, and has no answer when none is given', () => {
    expect(spotOf(a, 'en')).toBeNull();
    expect(spotOf({ ...a, spotEn: 'Find the lion.' }, 'en')?.answer).toBeNull();
  });
});

describe('spotCount', () => {
  it("counts a route's challenges and those found", () => {
    const places = bundledContent.places.map(p => (p.id === a.id ? withSpot : p.id === c.id ? { ...p, spotEn: 'Find the door knocker.' } : p));
    expect(spotCount(places, route.id, new Set([a.id, b.id]))).toEqual({ found: 1, total: 2 });
    expect(spotCount(bundledContent.places, route.id, new Set())).toEqual({ found: 0, total: 0 });
  });
});

describe('content', () => {
  it('keeps challenges and checks their length', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { spotEn: '  Find the lion.  ', spotAnswerFr: '' });
    const n = normalizeContent(content);
    expect(n.places[0].spotEn).toBe('Find the lion.');
    expect('spotAnswerFr' in n.places[0]).toBe(false);
    n.places[0].spotEn = 'x'.repeat(201);
    expect(validateContent(n).join(' ')).toContain('spotEn is longer than 200 characters');
  });
});

describe('translation drafts', () => {
  it('include the Spot it challenge and answer when there are English ones', async () => {
    const { missingPlaceText } = await import('../admin/translations');
    const missing = missingPlaceText({ ...withSpot, nameFr: 'x', descriptionFr: 'y' }, 'fr');
    expect(missing).toEqual({ spotFr: withSpot.spotEn, spotAnswerFr: 'Two and a half.' });
    expect(missingPlaceText({ ...a, nameEs: 'x', descriptionEs: 'y' }, 'es')).toEqual({});
  });
});
