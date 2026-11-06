import { describe, expect, it } from 'vitest';
import { effectiveTips, normalizeTips, tipLines, tipsProblems } from './visitor-tips';

describe('normalizeTips', () => {
  it('keeps well-formed parts and drops the rest', () => {
    expect(normalizeTips({ dress: true, shoesOff: 'yes', photos: 'noFlash', wheelchair: 'maybe', toilets: false, noteEn: ' Gate on the left ', noteFr: ' ', evil: 1 }))
      .toEqual({ dress: true, photos: 'noFlash', toilets: false, noteEn: 'Gate on the left' });
  });
  it('is undefined when nothing is set', () => {
    expect(normalizeTips(null)).toBeUndefined();
    expect(normalizeTips({ photos: 'sometimes' })).toBeUndefined();
  });
  it('checks note length', () => {
    expect(tipsProblems({ noteEs: 'x'.repeat(201) })).toEqual(['visitor tips noteEs is longer than 200 characters.']);
  });
});

describe('effectiveTips', () => {
  it('gives active mosques modest dress and shoes off until the admin sets tips', () => {
    expect(effectiveTips({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر' })).toEqual({ dress: true, shoesOff: true });
    expect(effectiveTips({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر', tips: { photos: 'yes' } })).toEqual({ photos: 'yes' });
    expect(effectiveTips({ nameEn: 'Sakna Basha House', nameAr: 'منزل' })).toBeUndefined();
    expect(effectiveTips({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر', mosque: false })).toBeUndefined();
    // Everything unticked by the admin: no tips, not the defaults.
    const none = effectiveTips({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر', tips: normalizeTips({ dress: false, shoesOff: false }) });
    expect(none).toEqual({ dress: false, shoesOff: false });
    expect(tipLines(none!, 'en')).toEqual([]);
  });
});

describe('tipLines', () => {
  const tips = { dress: true, shoesOff: true, photos: 'no' as const, wheelchair: 'partial' as const, toilets: true, noteEn: 'Enter by the side gate.' };
  it('words each tip, in order', () => {
    expect(tipLines(tips, 'en').map(l => l.icon)).toEqual(['dress', 'shoes', 'cameraOff', 'access', 'toilet', 'note']);
    expect(tipLines(tips, 'en')[2].text).toBe('No photos');
    expect(tipLines(tips, 'es')[1].text).toBe('Descálzate en el interior');
    expect(tipLines(tips, 'ar')[4].text).toBe('توجد دورات مياه');
  });
  it('shows the English note marked as English when there is none in the language', () => {
    expect(tipLines(tips, 'fr').at(-1)).toEqual({ icon: 'note', text: 'Enter by the side gate.', lang: 'en' });
    expect(tipLines({ ...tips, noteFr: 'Entrée par la porte latérale.' }, 'fr').at(-1)).toEqual({ icon: 'note', text: 'Entrée par la porte latérale.' });
  });
});
