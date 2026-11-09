// The visitor's language, and small helpers to pick text in it. The provider
// (LanguageContext.tsx) sets the current language while rendering, and a
// language change re-renders the app, so these work in components and in
// plain helpers alike.
//
// Every language the app knows is listed once, in LANGUAGES. English and
// Arabic are complete everywhere; the others are "optional": their content
// fields (nameFr, descriptionEs, …) may be empty, and then English is shown.
// Adding a language means a row here, a dictionary, and its translations.
//
// Shared by the browser, the API functions and the tests.

export const LANGS = ['en', 'ar', 'fr', 'es'] as const;
export type Lang = (typeof LANGS)[number];

/** Languages whose content is optional and falls back to English. */
export const OPTIONAL_LANGS = ['fr', 'es'] as const;
export type OptionalLang = (typeof OPTIONAL_LANGS)[number];

/** The suffix of a language's content fields: nameEn, nameAr, nameFr, nameEs. */
export type Suffix = 'En' | 'Ar' | 'Fr' | 'Es';
export type OptionalSuffix = 'Fr' | 'Es';

export interface LanguageInfo {
  /** Its own name, for the language picker. */
  native: string;
  /** Its English name, for the admin and for prompts to Gemini. */
  english: string;
  suffix: Suffix;
  /** For Intl (dates, weekdays). */
  locale: string;
  /** For the browser's speech voice. */
  speech: string;
  /** For Open Graph link previews. */
  og: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: Record<Lang, LanguageInfo> = {
  en: { native: 'English', english: 'English', suffix: 'En', locale: 'en-GB', speech: 'en-US', og: 'en_GB', dir: 'ltr' },
  ar: { native: 'العربية', english: 'Arabic', suffix: 'Ar', locale: 'ar-EG', speech: 'ar-EG', og: 'ar_EG', dir: 'rtl' },
  fr: { native: 'Français', english: 'French', suffix: 'Fr', locale: 'fr-FR', speech: 'fr-FR', og: 'fr_FR', dir: 'ltr' },
  es: { native: 'Español', english: 'Spanish', suffix: 'Es', locale: 'es-ES', speech: 'es-ES', og: 'es_ES', dir: 'ltr' },
};

// Interface text keyed by the English text, for the languages that have a
// dictionary (English and Arabic are written in place). Each is its own file,
// downloaded only for visitors using it: see loadDictionary.
const DICTIONARIES: Partial<Record<Lang, () => Promise<Record<string, string>>>> = {
  fr: () => import('./fr.js').then(m => m.FR),
  es: () => import('./es.js').then(m => m.ES),
};
const loaded: Partial<Record<Lang, Record<string, string>>> = {};

/**
 * Downloads a language's dictionary, once, before it's used: on start for
 * the starting language, and before switching. Never fails: without it (offline
 * before it was cached), the interface shows English, as for a missing string.
 */
export async function loadDictionary(lang: Lang): Promise<void> {
  const load = DICTIONARIES[lang];
  if (!load || loaded[lang]) return;
  try {
    loaded[lang] = await load();
  } catch {
    // English meanwhile; tried again on the next switch.
  }
}

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
export const isOptionalLang = (v: unknown): v is OptionalLang => typeof v === 'string' && (OPTIONAL_LANGS as readonly string[]).includes(v);

let current: Lang = 'en';
export const setCurrentLang = (lang: Lang) => {
  current = lang;
};
export const currentLang = () => current;

/**
 * Interface text: English and Arabic are written where the text is used;
 * other languages come from their dictionary, keyed by the English text
 * (falling back to English if a string has no translation yet).
 */
export function L(en: string, ar: string): string {
  if (current === 'ar') return ar;
  return loaded[current]?.[en] ?? en;
}

/**
 * Text written per language where it's used, for sentences built around
 * numbers or names ("Stop 3 of 12"). Languages left out fall back to English.
 */
export const byLang = (texts: { en: string; ar: string } & Partial<Record<Lang, string>>, lang: Lang = current) => texts[lang] ?? texts.en;

// A content field in a language: field(place, 'name', 'fr') is place.nameFr.
type Fields<Base extends string, V> = { [K in `${Base}${Suffix}`]?: V };
const field = <Base extends string, V>(o: Fields<Base, V>, base: Base, lang: Lang): V | undefined =>
  (o as Record<string, V | undefined>)[`${base}${LANGUAGES[lang].suffix}`];
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!v);

type Named = { nameEn: string; nameAr: string } & Fields<'name', string>;
type Described = Fields<'description', string>;
type Highlighted = { highlightsEn: string[]; highlightsAr: string[] } & Fields<'highlights', string[]>;

/** A place's, route's or category's name in the current language. */
export const nameOf = (o: Named, lang: Lang = current): string => field(o, 'name', lang) || o.nameEn;

/** A description in the current language ('' if there is none). */
export const descriptionOf = (o: Described, lang: Lang = current): string =>
  (lang === 'ar' ? o.descriptionAr : field(o, 'description', lang) || o.descriptionEn) || '';

/** A route's highlights in the current language. */
export const highlightsOf = (r: Highlighted, lang: Lang = current): string[] => {
  const own = field<'highlights', string[]>(r, 'highlights', lang);
  return own && own.length ? own : r.highlightsEn;
};

/**
 * The language to start in: the visitor's own earlier choice, else the
 * language of the link they opened (`?lang=` on a shared place), else the browser's.
 */
export function initialLang(saved: string | null, browser: string, fromLink?: string | null): Lang {
  if (isLang(saved)) return saved;
  if (isLang(fromLink)) return fromLink;
  return LANGS.find(l => l !== 'en' && browser.toLowerCase().startsWith(l)) ?? 'en';
}

/**
 * "en" when an optional language is showing but this content has no text in
 * it yet, so the English fallback is marked for screen readers; otherwise
 * undefined. fallbackLang(place, 'name').
 */
export function fallbackLang<Base extends string>(o: Fields<Base, string | string[]>, base: Base, lang: Lang = current): 'en' | undefined {
  return isOptionalLang(lang) && !filled(field(o, base, lang)) ? 'en' : undefined;
}

/**
 * Optional text kept per language (e.g. an entry fee: feeEn, feeAr, …), all
 * of which fall back to English; `lang` is "en" when the fallback is showing,
 * for screen readers. optionalText(place, 'fee').
 */
export function optionalText<Base extends string>(o: Fields<Base, string>, base: Base, lang: Lang = current): { text: string; lang: 'en' | undefined } {
  const own = field(o, base, lang);
  if (own) return { text: own, lang: undefined };
  const en = field(o, base, 'en') ?? '';
  return { text: en, lang: lang === 'en' || !en ? undefined : 'en' };
}
