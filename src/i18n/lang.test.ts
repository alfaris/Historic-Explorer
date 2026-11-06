import { afterEach, describe, expect, it } from 'vitest';
import { byLang, descriptionOf, fallbackLang, highlightsOf, initialLang, L, LANGS, LANGUAGES, nameOf, optionalText, setCurrentLang } from './lang';
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
  it('marks English fallback text only while an optional language is showing', () => {
    setCurrentLang('fr');
    expect(fallbackLang({}, 'name')).toBe('en');
    expect(fallbackLang({ highlightsFr: [] }, 'highlights')).toBe('en');
    expect(fallbackLang({ nameFr: 'Mosquée' }, 'name')).toBeUndefined();
    setCurrentLang('es');
    expect(fallbackLang({ nameFr: 'Mosquée' }, 'name')).toBe('en');
    expect(fallbackLang({ nameEs: 'Mezquita' }, 'name')).toBeUndefined();
    setCurrentLang('ar');
    expect(fallbackLang({}, 'name')).toBeUndefined();
    setCurrentLang('en');
  });
});

describe('optionalText', () => {
  it('uses the language’s own text, else English marked as English', () => {
    const fee = { feeEn: 'EGP 60', feeAr: '60 جنيهًا', feeEs: '60 EGP' };
    expect(optionalText(fee, 'fee', 'ar')).toEqual({ text: '60 جنيهًا', lang: undefined });
    expect(optionalText(fee, 'fee', 'es')).toEqual({ text: '60 EGP', lang: undefined });
    expect(optionalText(fee, 'fee', 'fr')).toEqual({ text: 'EGP 60', lang: 'en' });
    expect(optionalText(fee, 'fee', 'en')).toEqual({ text: 'EGP 60', lang: undefined });
    expect(optionalText({}, 'fee', 'fr')).toEqual({ text: '', lang: undefined });
  });
});

describe('initialLang from a shared link', () => {
  it('uses the link’s language unless the visitor already chose one', () => {
    expect(initialLang(null, 'en-US', 'fr')).toBe('fr');
    expect(initialLang(null, 'en-US', 'es')).toBe('es');
    expect(initialLang(null, 'ar-EG', 'en')).toBe('en'); // an English share opened on an Arabic phone
    expect(initialLang('ar', 'en-US', 'fr')).toBe('ar');
    expect(initialLang(null, 'fr-FR', 'de')).toBe('fr');
    expect(initialLang(null, 'en-US', null)).toBe('en');
  });
  it('follows a Spanish browser, and a saved Spanish choice', () => {
    expect(initialLang(null, 'es-MX')).toBe('es');
    expect(initialLang('es', 'en-US')).toBe('es');
  });
});

describe('Spanish', () => {
  it('picks Spanish content, falling back to English', () => {
    const place = { nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر', nameEs: 'Mezquita de Al-Azhar', descriptionEn: 'Old.' };
    expect(nameOf(place, 'es')).toBe('Mezquita de Al-Azhar');
    expect(descriptionOf(place, 'es')).toBe('Old.');
    expect(nameOf({ nameEn: 'X', nameAr: 'س' }, 'es')).toBe('X');
  });
  it('translates interface text from the Spanish dictionary, and byLang falls back to English', () => {
    setCurrentLang('es');
    expect(L('Share route', 'مشاركة المسار')).toBe('Compartir la ruta');
    expect(L('Not in the dictionary', 'س')).toBe('Not in the dictionary');
    expect(byLang({ en: 'a', ar: 'b', es: 'c' })).toBe('c');
    expect(byLang({ en: 'a', ar: 'b' })).toBe('a');
    setCurrentLang('en');
  });
  it('has a language row for every language', () => {
    for (const l of LANGS) expect(LANGUAGES[l].suffix.toLowerCase()).toBe(l);
  });
});
