import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { photoTipOf } from './spot-it';
import { missingPlaceText } from '../admin/translations';
import { placeGaps, progress } from '../admin/content-health';
import { duplicatePlace } from '../admin/duplicate-place';

const place = bundledContent.places[0];
const withTip = { ...place, photoTipEn: 'Stand by the north gate at sunset.', photoTipAr: 'قف عند البوابة الشمالية وقت الغروب.' };

describe('photoTipOf', () => {
  it('gives the tip in the language, falling back to English (marked as English)', () => {
    expect(photoTipOf(withTip, 'ar')).toEqual({ text: withTip.photoTipAr, lang: undefined });
    expect(photoTipOf(withTip, 'es')).toEqual({ text: withTip.photoTipEn, lang: 'en' });
    expect(photoTipOf({ ...place, photoTipEn: '  ' }, 'en')).toBeNull();
  });
});

describe('content', () => {
  it('keeps tips, drops empty ones and checks their length', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { photoTipEn: '  At dawn.  ', photoTipFr: '' });
    const n = normalizeContent(content);
    expect(n.places[0].photoTipEn).toBe('At dawn.');
    expect('photoTipFr' in n.places[0]).toBe(false);
    n.places[0].photoTipEs = 'x'.repeat(251);
    expect(validateContent(n).join(' ')).toContain('photoTipEs is longer than 250 characters');
  });
});

describe('admin', () => {
  it('asks for a translation when there is an English tip', () => {
    expect(missingPlaceText({ ...withTip, nameFr: 'x', descriptionFr: 'y' }, 'fr')).toEqual({ photoTipFr: withTip.photoTipEn });
  });

  it('lists a missing tip for must-see stops only', () => {
    expect(placeGaps({ ...place, mustSee: true })).toContain('photoTip');
    expect(placeGaps({ ...withTip, mustSee: true })).not.toContain('photoTip');
    expect(placeGaps({ ...place, mustSee: false })).not.toContain('photoTip');
    const content = { ...bundledContent, places: bundledContent.places.map((p, i) => (i < 3 ? { ...p, mustSee: true, ...(i === 0 ? { photoTipEn: 'x' } : {}) } : p)) };
    expect(progress(content).find(x => x.id === 'photoTip')).toMatchObject({ done: 1, total: 3 });
  });

  it("isn't copied to a duplicate place", () => {
    const copy = duplicatePlace(withTip, 999);
    expect('photoTipEn' in copy || 'photoTipAr' in copy).toBe(false);
  });
});
