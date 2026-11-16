import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { summaryOf } from './spot-it';
import { missingPlaceText } from '../admin/translations';
import { draftSection, placeGaps, progress } from '../admin/content-health';

const place = bundledContent.places[0];
const withSummary = { ...place, summaryEn: 'A 9th-century mosque with a spiral minaret.', summaryAr: 'مسجد من القرن التاسع بمئذنة ملوية.' };

describe('summaryOf', () => {
  it('gives the line in the language, falling back to English (marked as English)', () => {
    expect(summaryOf(withSummary, 'ar')).toEqual({ text: withSummary.summaryAr, lang: undefined });
    expect(summaryOf(withSummary, 'fr')).toEqual({ text: withSummary.summaryEn, lang: 'en' });
    expect(summaryOf(place, 'en')).toBeNull();
  });
});

describe('content', () => {
  it('keeps summaries, drops empty ones and checks their length', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { summaryEn: '  A mosque.  ', summaryEs: '' });
    const n = normalizeContent(content);
    expect(n.places[0].summaryEn).toBe('A mosque.');
    expect('summaryEs' in n.places[0]).toBe(false);
    n.places[0].summaryFr = 'x'.repeat(161);
    expect(validateContent(n).join(' ')).toContain('summaryFr is longer than 160 characters');
  });
});

describe('admin', () => {
  it('asks for a translation when there is an English line', () => {
    expect(missingPlaceText({ ...withSummary, nameEs: 'x', descriptionEs: 'y' }, 'es')).toEqual({ summaryEs: withSummary.summaryEn });
  });

  it('lists a missing line for must-see stops only, and finds its section', () => {
    expect(placeGaps({ ...place, mustSee: true })).toContain('summary');
    expect(placeGaps({ ...withSummary, mustSee: true })).not.toContain('summary');
    expect(placeGaps(place)).not.toContain('summary');
    const content = { ...bundledContent, places: bundledContent.places.map((p, i) => (i < 2 ? { ...p, mustSee: true, ...(i === 0 ? { summaryEn: 'x' } : {}) } : p)) };
    expect(progress(content).find(x => x.id === 'summary')).toMatchObject({ done: 1, total: 2 });
    expect(draftSection('summaryAr')).toBe('summary');
    expect(draftSection('summaryFr')).toBe('summary');
  });
});
