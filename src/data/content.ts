// The editable content: routes and places. The admin dashboard edits it and
// the server stores it in Vercel Blob. The data in locations.ts is the
// starting point and the fallback whenever the live copy can't be loaded.
//
// Shared by the browser, the API functions and the tests, so it must not
// import anything browser- or server-specific.

import { categories, locations, routes, type Category, type Location, type Route } from './locations.js';
import type { Photo } from './photos';
import { parseDistanceKm, parseHours, routeText } from '../lib/route-format.js';
import { hoursProblems, normalizeHours } from '../lib/opening-hours.js';
import { normalizeTips, tipsProblems } from '../lib/visitor-tips.js';
import { glossaryProblems, normalizeGlossary, type GlossaryTerm } from '../lib/glossary.js';
import { DEFAULT_GLOSSARY } from './glossary.js';
import { LANGS, LANGUAGES, OPTIONAL_LANGS } from '../i18n/lang.js';

export type { Category, Location, Route };

export interface Content {
  routes: Route[];
  places: Location[];
  /** Highest place ID ever used, so IDs of deleted places are never reused. */
  maxPlaceId?: number;
  /** Architecture terms linked in descriptions. Absent until the admin saves one: DEFAULT_GLOSSARY applies. */
  glossary?: GlossaryTerm[];
}

export const bundledContent: Content = { routes, places: locations };

/** The glossary in use: the saved one, or the built-in one. */
export const glossaryOf = (content: Content): GlossaryTerm[] => content.glossary ?? DEFAULT_GLOSSARY;

export const CATEGORY_IDS = categories.map(c => c.id) as Category[];

// Roughly Greater Cairo. Generous, but catches swapped lat/lng and typos.
export const CAIRO_BOUNDS = { minLat: 29.9, maxLat: 30.15, minLng: 31.1, maxLng: 31.4 };

const LIMITS = { name: 120, description: 2000, highlights: 8, fee: 120 };

const hasArabic = (value: string) => /[؀-ۿ]/.test(value);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Photo addresses content may use: uploads served by /api/photo, or built-in files. */
export const PHOTO_SRC = /^(\/api\/photo\?id=[0-9a-f]{64}|\/images\/photos\/[a-z0-9-]+\.webp)$/;

const normalizePhoto = (p: any): Photo | undefined => {
  if (!p || typeof p !== 'object' || !str(p.src)) return undefined;
  return {
    src: str(p.src),
    width: Number(p.width),
    height: Number(p.height),
    author: str(p.author),
    license: str(p.license),
    licenseUrl: str(p.licenseUrl) || null,
    sourceUrl: str(p.sourceUrl),
  };
};

const httpsUrl = (v: string | null) => !v || (/^https:\/\/[^\s]+$/.test(v) && v.length <= 500);

function photoProblems(label: string, photo: Photo | undefined): string[] {
  if (!photo) return [];
  const problems: string[] = [];
  if (!PHOTO_SRC.test(photo.src)) problems.push(`${label}: photo address isn't one of the app's photos.`);
  if (![photo.width, photo.height].every(d => Number.isInteger(d) && d >= 1 && d <= 4000)) problems.push(`${label}: photo size is invalid.`);
  if (!photo.author || photo.author.length > 120) problems.push(`${label}: photo credit (author) is required.`);
  if (!photo.license || photo.license.length > 80) problems.push(`${label}: photo license is required (e.g. "Own photo" or "CC BY-SA 4.0").`);
  if (!httpsUrl(photo.licenseUrl) || !httpsUrl(photo.sourceUrl)) problems.push(`${label}: photo links must be https:// addresses.`);
  return problems;
}

const finite = (v: unknown) => (v === null || v === '' || v === undefined ? NaN : Number(v));

/**
 * A route's distance and walking time as numbers, read from the number fields
 * or, for older content, from the text ("2.5 km", "2-3 hours"), plus the
 * English text made from them.
 */
function routeNumbers(r: any) {
  let distanceKm = finite(r?.distanceKm);
  if (!Number.isFinite(distanceKm)) distanceKm = parseDistanceKm(str(r?.distance));
  let hoursMin = finite(r?.hoursMin);
  let hoursMax = finite(r?.hoursMax);
  if (!Number.isFinite(hoursMin) || !Number.isFinite(hoursMax)) [hoursMin, hoursMax] = parseHours(str(r?.duration)) ?? [NaN, NaN];
  const numbers = { distanceKm, hoursMin, hoursMax };
  return { ...numbers, ...routeText(numbers) };
}

// Optional per-language fields (nameFr, descriptionEs, feeAr, …) that have
// text, trimmed; empty ones are left out.
const textFields = (o: any, bases: string[], langs: readonly (keyof typeof LANGUAGES)[]) =>
  Object.fromEntries(
    langs.flatMap(l => bases.map(b => `${b}${LANGUAGES[l].suffix}`)).filter(k => str(o?.[k])).map(k => [k, str(o[k])]),
  );
const listFields = (o: any, base: string) =>
  Object.fromEntries(
    OPTIONAL_LANGS.map(l => `${base}${LANGUAGES[l].suffix}`)
      .map(k => [k, Array.isArray(o?.[k]) ? o[k].map(str).filter(Boolean) : []] as const)
      .filter(([, v]) => v.length),
  );

/**
 * Copies only the known fields, trimmed and typed, so whatever a client sends
 * can't add unexpected properties to the stored content.
 */
export function normalizeContent(input: unknown): Content {
  const raw = (input ?? {}) as { routes?: unknown; places?: unknown };
  const routesIn = Array.isArray(raw.routes) ? raw.routes : [];
  const placesIn = Array.isArray(raw.places) ? raw.places : [];
  const maxPlaceId = Number((raw as { maxPlaceId?: unknown }).maxPlaceId);
  const glossary = normalizeGlossary((raw as { glossary?: unknown }).glossary);
  return {
    ...(Number.isInteger(maxPlaceId) && maxPlaceId > 0 ? { maxPlaceId } : {}),
    ...(glossary ? { glossary } : {}),
    routes: routesIn.map((r: any): Route => ({
      id: str(r?.id),
      nameEn: str(r?.nameEn),
      nameAr: str(r?.nameAr),
      descriptionEn: str(r?.descriptionEn),
      descriptionAr: str(r?.descriptionAr),
      image: '',
      highlightsEn: Array.isArray(r?.highlightsEn) ? r.highlightsEn.map(str).filter(Boolean) : [],
      highlightsAr: Array.isArray(r?.highlightsAr) ? r.highlightsAr.map(str).filter(Boolean) : [],
      // French and Spanish are optional; empty fields are left out (the app falls back to English).
      ...textFields(r, ['name', 'description'], OPTIONAL_LANGS),
      ...listFields(r, 'highlights'),
      ...routeNumbers(r),
      ...(normalizePhoto(r?.photo) ? { photo: normalizePhoto(r?.photo) } : {}),
    })),
    places: placesIn.map((p: any): Location => ({
      id: Number(p?.id),
      routeId: str(p?.routeId),
      nameEn: str(p?.nameEn),
      nameAr: str(p?.nameAr),
      category: str(p?.category) as Category,
      descriptionEn: str(p?.descriptionEn),
      descriptionAr: str(p?.descriptionAr),
      ...textFields(p, ['name', 'description'], OPTIONAL_LANGS),
      ...(typeof p?.mosque === 'boolean' ? { mosque: p.mosque } : {}),
      ...(normalizeTips(p?.tips) ? { tips: normalizeTips(p?.tips) } : {}),
      ...(normalizeHours(p?.hours) ? { hours: normalizeHours(p?.hours) } : {}),
      ...textFields(p, ['fee'], LANGS),
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      ...(normalizePhoto(p?.photo) ? { photo: normalizePhoto(p?.photo) } : {}),
    })),
  };
}

/**
 * Checks content before it's published. Returns human-readable problems; an
 * empty list means it's valid. The server refuses to save content with
 * problems, and the tests run this against the bundled data.
 */
export function validateContent(content: Content): string[] {
  const problems: string[] = [];
  const routeIds = new Set<string>();

  if (content.routes.length === 0) problems.push('There must be at least one route.');

  for (const r of content.routes) {
    const label = `Route "${r.nameEn || r.id || '(unnamed)'}"`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) problems.push(`${label}: ID must be lowercase letters, numbers and dashes.`);
    else if (routeIds.has(r.id)) problems.push(`${label}: ID "${r.id}" is used twice.`);
    routeIds.add(r.id);
    if (!r.nameEn) problems.push(`${label}: English name is empty.`);
    if (!hasArabic(r.nameAr)) problems.push(`${label}: Arabic name is missing.`);
    if (!r.descriptionEn) problems.push(`${label}: English description is empty.`);
    if (!hasArabic(r.descriptionAr)) problems.push(`${label}: Arabic description is missing.`);
    if (!(r.distanceKm > 0 && r.distanceKm <= 50)) problems.push(`${label}: distance must be a number of kilometres, above 0 and at most 50.`);
    if (!(r.hoursMin > 0 && r.hoursMax <= 24 && r.hoursMin <= r.hoursMax)) problems.push(`${label}: walking time must be in hours, above 0, at most 24, with "from" no more than "to".`);
    if (r.highlightsEn.length !== r.highlightsAr.length) problems.push(`${label}: English and Arabic highlights must have the same number of lines.`);
    if (r.highlightsEn.length > LIMITS.highlights) problems.push(`${label}: at most ${LIMITS.highlights} highlights.`);
    for (const lang of OPTIONAL_LANGS) {
      const s = LANGUAGES[lang].suffix;
      const highlights = r[`highlights${s}`];
      if (highlights && highlights.length > LIMITS.highlights) problems.push(`${label}: at most ${LIMITS.highlights} ${LANGUAGES[lang].english} highlights.`);
      for (const [field, max] of [[`name${s}`, LIMITS.name], [`description${s}`, LIMITS.description]] as const) {
        if ((r[field] ?? '').length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
      }
    }
    for (const [field, max] of [['nameEn', LIMITS.name], ['nameAr', LIMITS.name], ['descriptionEn', LIMITS.description], ['descriptionAr', LIMITS.description]] as const) {
      if (r[field].length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
    }
    problems.push(...photoProblems(label, r.photo));
  }

  const placeIds = new Set<number>();
  const coords = new Map<string, string>();
  for (const p of content.places) {
    const label = `Place "${p.nameEn || p.id || '(unnamed)'}"`;
    if (!Number.isInteger(p.id) || p.id < 1 || p.id > 999_999) problems.push(`${label}: ID must be a whole number from 1 to 999999.`);
    else if (placeIds.has(p.id)) problems.push(`${label}: ID ${p.id} is used twice.`);
    placeIds.add(p.id);
    if (!routeIds.has(p.routeId)) problems.push(`${label}: route "${p.routeId}" doesn't exist.`);
    if (!CATEGORY_IDS.includes(p.category)) problems.push(`${label}: category "${p.category}" isn't valid.`);
    if (!p.nameEn) problems.push(`${label}: English name is empty.`);
    if (!hasArabic(p.nameAr)) problems.push(`${label}: Arabic name is missing.`);
    // The audio guide narrates these, so both languages need one.
    if (!p.descriptionEn) problems.push(`${label}: English description is empty.`);
    if (!hasArabic(p.descriptionAr ?? '')) problems.push(`${label}: Arabic description is missing.`);
    const optional = OPTIONAL_LANGS.flatMap(l => [[`name${LANGUAGES[l].suffix}`, LIMITS.name], [`description${LANGUAGES[l].suffix}`, LIMITS.description]] as const);
    const fees = LANGS.map(l => [`fee${LANGUAGES[l].suffix}`, LIMITS.fee] as const);
    for (const [field, max] of [['nameEn', LIMITS.name], ['nameAr', LIMITS.name], ['descriptionEn', LIMITS.description], ['descriptionAr', LIMITS.description], ...optional, ...fees] as const) {
      if ((p[field] ?? '').length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
    }
    if (p.hours) problems.push(...hoursProblems(p.hours).map(problem => `${label}: ${problem}`));
    if (p.tips) problems.push(...tipsProblems(p.tips).map(problem => `${label}: ${problem}`));
    problems.push(...photoProblems(label, p.photo));
    const b = CAIRO_BOUNDS;
    if (!(p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng)) {
      problems.push(`${label}: coordinates are outside Cairo (check latitude and longitude aren't swapped).`);
    } else {
      const key = `${p.lat},${p.lng}`;
      const other = coords.get(key);
      if (other) problems.push(`${label}: has exactly the same coordinates as "${other}".`);
      coords.set(key, p.nameEn);
    }
  }
  if (content.glossary) problems.push(...glossaryProblems(content.glossary));
  return problems;
}

const highestId = (content: Content) => Math.max(0, content.maxPlaceId ?? 0, ...content.places.map(p => p.id));

/**
 * Next place ID. Never reuses the ID of a deleted place: visited marks,
 * built-in photos and reports refer to places by ID.
 */
export const nextPlaceId = (content: Content) => highestId(content) + 1;

/** Content with maxPlaceId raised to cover every ID in it and in `previous`. */
export const withMaxPlaceId = (content: Content, previous?: Content): Content => ({
  ...content,
  maxPlaceId: Math.max(highestId(content), previous ? highestId(previous) : 0),
});
