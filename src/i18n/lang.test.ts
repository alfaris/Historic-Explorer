import { afterEach, describe, expect, it } from 'vitest';
import { descriptionOf, fallbackLang, highlightsOf, optionalText, initialLang, L, nameOf, setCurrentLang } from './lang';
import { FR } from './fr';

afterEach(() => setCurrentLang('en'));
const place = { nameEn: 'Manial Palace', nameAr: 'قصر المنيل', descriptionEn: 'English', descriptionAr: 'عربي' };

describe('L', () => {
  it('picks the current language, with French from the dictionary', () => {
    expect(L('Visited', 'تمت الزيارة')).toBe('Visited');
    setCurrentLang('ar');
    expect(L('Visited', 'تمت الزيارة')).toBe('تمت الزيارة');
    setCurrentLang('fr');
    expect(L('Visited', 'تمت الزيارة')).toBe(FR['Visited'] ?? 'Visited');
    expect(L('Some string with no French', 'x')).toBe('Some string with no French');
  });
});

describe('content pickers', () => {
  it('fall back to English when French is missing', () => {
    setCurrentLang('fr');
    expect(nameOf(place)).toBe('Manial Palace');
    expect(descriptionOf(place)).toBe('English');
    expect(nameOf({ ...place, nameFr: 'Palais de Manial' })).toBe('Palais de Manial');
    expect(descriptionOf({ ...place, descriptionFr: 'Français' })).toBe('Français');
    expect(highlightsOf({ highlightsEn: ['a'], highlightsAr: ['ب'], highlightsFr: [] })).toEqual(['a']);
    expect(highlightsOf({ highlightsEn: ['a'], highlightsAr: ['ب'], highlightsFr: ['b'] })).toEqual(['b']);
  });

  it('use Arabic in Arabic', () => {
    expect(nameOf(place, 'ar')).toBe('قصر المنيل');
    expect(descriptionOf(place, 'ar')).toBe('عربي');
  });
});

describe('initialLang', () => {
  it('prefers a saved choice, then the browser language', () => {
    expect(initialLang('fr', 'en-US')).toBe('fr');
    expect(initialLang(null, 'fr-FR')).toBe('fr');
    expect(initialLang(null, 'ar-EG')).toBe('ar');
    expect(initialLang(null, 'de-DE')).toBe('en');
    expect(initialLang('xx', 'en')).toBe('en');
  });
});

describe('fallbackLang', () => {
  it('marks English fallback text only while French is showing', () => {
    setCurrentLang('fr');
    expect(fallbackLang(undefined)).toBe('en');
    expect(fallbackLang([])).toBe('en');
    expect(fallbackLang('Mosquée')).toBeUndefined();
    setCurrentLang('ar');
    expect(fallbackLang(undefined)).toBeUndefined();
    setCurrentLang('en');
  });
});

describe('optionalText', () => {
  it('uses the language’s own text, else English marked as English', () => {
    expect(optionalText('EGP 60', '60 جنيهًا', undefined, 'ar')).toEqual({ text: '60 جنيهًا', lang: undefined });
    expect(optionalText('EGP 60', undefined, undefined, 'fr')).toEqual({ text: 'EGP 60', lang: 'en' });
    expect(optionalText('EGP 60', undefined, undefined, 'en')).toEqual({ text: 'EGP 60', lang: undefined });
    expect(optionalText(undefined, undefined, undefined, 'fr')).toEqual({ text: '', lang: undefined });
  });
});

describe('initialLang from a shared link', () => {
  it('uses the link’s language unless the visitor already chose one', () => {
    expect(initialLang(null, 'en-US', 'fr')).toBe('fr');
    expect(initialLang('ar', 'en-US', 'fr')).toBe('ar');
    expect(initialLang(null, 'fr-FR', 'de')).toBe('fr');
    expect(initialLang(null, 'en-US', null)).toBe('en');
  });
});
