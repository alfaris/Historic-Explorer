// The visitor's language, and small helpers to pick text in it. The provider
// (LanguageContext.tsx) sets the current language while rendering, and a
// language change re-renders the app, so these work in components and in
// plain helpers alike.

import { FR } from './fr.js';

export type Lang = 'en' | 'ar' | 'fr';
export const LANGS: Lang[] = ['en', 'ar', 'fr'];

let current: Lang = 'en';
export const setCurrentLang = (lang: Lang) => {
  current = lang;
};
export const currentLang = () => current;

/**
 * Interface text: English and Arabic are written where the text is used;
 * French comes from the FR dictionary, keyed by the English text (falling
 * back to English if a string has no French yet).
 */
export function L(en: string, ar: string): string {
  if (current === 'ar') return ar;
  if (current === 'fr') return FR[en] ?? en;
  return en;
}

type Named = { nameEn: string; nameAr: string; nameFr?: string };
type Described = { descriptionEn?: string; descriptionAr?: string; descriptionFr?: string };

/** A place's, route's or category's name in the current language. */
export const nameOf = (o: Named, lang: Lang = current) =>
  lang === 'ar' ? o.nameAr : lang === 'fr' ? o.nameFr || o.nameEn : o.nameEn;

/** A description in the current language ('' if there is none). */
export const descriptionOf = (o: Described, lang: Lang = current) =>
  (lang === 'ar' ? o.descriptionAr : lang === 'fr' ? o.descriptionFr || o.descriptionEn : o.descriptionEn) || '';

/** A route's highlights in the current language. */
export const highlightsOf = (r: { highlightsEn: string[]; highlightsAr: string[]; highlightsFr?: string[] }, lang: Lang = current) =>
  lang === 'ar' ? r.highlightsAr : lang === 'fr' && r.highlightsFr?.length ? r.highlightsFr : r.highlightsEn;

/** The language to start in: a saved choice, else the browser's, else English. */
export function initialLang(saved: string | null, browser: string): Lang {
  if (saved === 'en' || saved === 'ar' || saved === 'fr') return saved;
  if (browser.startsWith('ar')) return 'ar';
  if (browser.startsWith('fr')) return 'fr';
  return 'en';
}

/**
 * "en" when French is showing but this content has no French yet, so the
 * English fallback is marked for screen readers; otherwise undefined.
 */
export const fallbackLang = (french: string | string[] | undefined) =>
  current === 'fr' && !(Array.isArray(french) ? french.length : french) ? 'en' : undefined;

/**
 * Optional text kept in three languages (e.g. an entry fee). Arabic and French
 * fall back to English; `lang` is "en" when the fallback is showing, for screen readers.
 */
export function optionalText(en: string | undefined, ar: string | undefined, fr: string | undefined, lang: Lang = current): { text: string; lang: 'en' | undefined } {
  const own = lang === 'ar' ? ar : lang === 'fr' ? fr : en;
  if (own) return { text: own, lang: undefined };
  return { text: en ?? '', lang: lang === 'en' || !en ? undefined : 'en' };
}
