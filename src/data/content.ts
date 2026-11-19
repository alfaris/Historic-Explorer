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
import { normalizePeriods, periodProblems, type SpecialPeriod } from '../lib/special-hours.js';
import { builtProblems, normalizeBuilt } from '../lib/eras.js';
import { normalizeDrafted } from '../lib/drafted.js';
import { helpProblems, normalizeHelp, type HelpContent } from '../lib/help-content.js';
import { noticeProblems, normalizeNotices, withoutMissing, type Notice } from '../lib/notices.js';
import { LANGS, LANGUAGES, OPTIONAL_LANGS } from '../i18n/lang.js';

export type { Category, Location, Route };

export interface Content {
  routes: Route[];
  places: Location[];
  /** Highest place ID ever used, so IDs of deleted places are never reused. */
  maxPlaceId?: number;
  /** Architecture terms linked in descriptions. Absent until the admin saves one: DEFAULT_GLOSSARY applies. */
  glossary?: GlossaryTerm[];
  /** Ramadan, Eid, one-off closures: dates on which some places keep other hours. */
  specialPeriods?: SpecialPeriod[];
  /** The Help sheet's own contacts, tips and phrases (the emergency numbers are fixed in the app). */
  help?: HelpContent;
  /** Announcements for visitors (closures, works, events), app-wide or on a route or place. */
  notices?: Notice[];
}

export const bundledContent: Content = { routes, places: locations };

/** The glossary in use: the saved one, or the built-in one. */
export const glossaryOf = (content: Content): GlossaryTerm[] => content.glossary ?? DEFAULT_GLOSSARY;

export const CATEGORY_IDS = categories.map(c => c.id) as Category[];

// Roughly Greater Cairo. Generous, but catches swapped lat/lng and typos.
export const CAIRO_BOUNDS = { minLat: 29.9, maxLat: 30.15, minLng: 31.1, maxLng: 31.4 };

const LIMITS = { name: 120, description: 2000, highlights: 8, fee: 120, photoAlt: 250, spot: 200, spotAnswer: 120, photoTip: 250, summary: 160, metro: 80, gettingThere: 300 };

/**
 * `text` cut to the length a text field allows (by its name, e.g.
 * "summaryFr"), at a word where it can, with "…": for Gemini's drafts, which
 * can come back longer in another language than the save allows. Fields
 * without a length limit (and lists) are left alone.
 */
export function fitToLimit(field: string, text: string): string {
  const base = field.replace(/(En|Ar|Fr|Es)$/, '') as keyof typeof LIMITS;
  const max = base === 'highlights' ? undefined : LIMITS[base];
  if (!max || text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

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

/** How many extra photos a place can have, besides its main one. */
export const MAX_GALLERY = 4;

/** A place's extra photos from untrusted input: photos with their descriptions; undefined when there are none. */
const normalizeGallery = (g: unknown) => {
  if (!Array.isArray(g)) return undefined;
  const photos = g.flatMap(item => {
    const photo = normalizePhoto(item);
    return photo ? [{ ...photo, ...textFields(item, ['photoAlt'], LANGS) }] : [];
  });
  return photos.length ? photos : undefined;
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

/** Photo descriptions (photoAltEn, …) longer than a screen reader should read out. */
const photoAltProblems = (label: string, o: object) =>
  LANGS.map(l => `photoAlt${LANGUAGES[l].suffix}`)
    .filter(k => String((o as Record<string, unknown>)[k] ?? '').length > LIMITS.photoAlt)
    .map(k => `${label}: ${k} (photo description) is longer than ${LIMITS.photoAlt} characters.`);

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
  const specialPeriods = normalizePeriods((raw as { specialPeriods?: unknown }).specialPeriods);
  const help = normalizeHelp((raw as { help?: unknown }).help);
  const content: Content = {
    ...(help ? { help } : {}),
    ...(specialPeriods ? { specialPeriods } : {}),
    // Place IDs stop at 999999 (validateContent); a larger value is a bad edit and would make every new ID the same.
    ...(Number.isInteger(maxPlaceId) && maxPlaceId > 0 && maxPlaceId <= 999_999 ? { maxPlaceId } : {}),
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
      ...textFields(r, ['photoAlt', 'metro', 'gettingThere'], LANGS),
      // A start point that's no longer on the route (deleted or moved) is dropped: the first stop applies.
      ...(placesIn.some((p: any) => Number(p?.id) === Number(r?.startId) && str(p?.routeId) === str(r?.id)) ? { startId: Number(r.startId) } : {}),
      ...(Number.isInteger(Number(r?.metroMinutes)) && Number(r?.metroMinutes) > 0 ? { metroMinutes: Number(r.metroMinutes) } : {}),
      ...normalizeDrafted(r),
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
      ...(p?.mustSee === true ? { mustSee: true } : {}),
      ...(normalizeTips(p?.tips) ? { tips: normalizeTips(p?.tips) } : {}),
      ...(normalizeHours(p?.hours) ? { hours: normalizeHours(p?.hours) } : {}),
      ...normalizeBuilt(p),
      ...textFields(p, ['fee', 'spot', 'spotAnswer', 'photoTip', 'summary'], LANGS),
      lat: Number(p?.lat),
      lng: Number(p?.lng),
      ...(normalizePhoto(p?.photo) ? { photo: normalizePhoto(p?.photo) } : {}),
      ...textFields(p, ['photoAlt'], LANGS),
      ...(normalizeGallery(p?.gallery) ? { gallery: normalizeGallery(p?.gallery) } : {}),
      ...normalizeDrafted(p),
      // Kept only while the pin is where it was confirmed: moving it asks again.
      ...(p?.pinChecked && Number(p.pinChecked.lat) === Number(p?.lat) && Number(p.pinChecked.lng) === Number(p?.lng) ? { pinChecked: { lat: Number(p.lat), lng: Number(p.lng) } } : {}),
    })),
  };
  // A notice on a route or place that's been deleted is dropped with it.
  const notices = withoutMissing(normalizeNotices((raw as { notices?: unknown }).notices), new Set(content.routes.map(r => r.id)), new Set(content.places.map(p => p.id)));
  return notices ? { ...content, notices } : content;
}

/**
 * The content as visitors can be shown it: places that can't be shown at all
 * (on a route that doesn't exist, an unknown category, no position, no name
 * in any language, or an ID already used, the first one kept) are left out,
 * and routes with no name or an ID already used too. Null when no route or no place is left. Looser than
 * validateContent on purpose: content saved before a check was added (a new
 * length limit, say) fails validateContent, but visitors keep seeing it, less
 * any place that can't be shown, rather than lose everything the admin added
 * (the admin is asked to fix it).
 */
export function usableContent(content: Content): Content | null {
  const routeIds = new Set<string>();
  const routes = content.routes.filter(r => !!(r.nameEn || r.nameAr) && !routeIds.has(r.id) && routeIds.add(r.id));
  const placeIds = new Set<number>();
  const places = content.places.filter(
    p =>
      Number.isInteger(p.id) && !placeIds.has(p.id) && routeIds.has(p.routeId) && CATEGORY_IDS.includes(p.category) && !!(p.nameEn || p.nameAr) &&
      Number.isFinite(p.lat) && Number.isFinite(p.lng) && placeIds.add(p.id),
  );
  if (routes.length === 0 || places.length === 0) return null;
  return routes.length === content.routes.length && places.length === content.places.length ? content : { ...content, routes, places };
}

/** Whether every route and place can be shown as it is (usableContent leaves nothing out). */
export const isUsableContent = (content: Content) => usableContent(content) === content;

/**
 * Checks content before it's published. Returns human-readable problems; an
 * empty list means it's valid. The server refuses to save content with
 * problems, and the tests run this against the bundled data.
 */
export function validateContent(content: Content): string[] {
  const problems: string[] = [];
  const routeIds = new Set<string>();

  if (content.routes.length === 0) problems.push('There must be at least one route.');
  // Content with no place can't be shown (isUsableContent), so it can't be saved either.
  if (content.places.length === 0) problems.push('There must be at least one place.');

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
    problems.push(...photoProblems(label, r.photo), ...photoAltProblems(label, r));
    for (const l of LANGS) {
      for (const base of ['metro', 'gettingThere'] as const) {
        const field = `${base}${LANGUAGES[l].suffix}` as const;
        if ((r[field] ?? '').length > LIMITS[base]) problems.push(`${label}: ${field} is longer than ${LIMITS[base]} characters.`);
      }
    }
    if (r.metroMinutes !== undefined && !(Number.isInteger(r.metroMinutes) && r.metroMinutes >= 1 && r.metroMinutes <= 60)) {
      problems.push(`${label}: the walk from the metro must be whole minutes, from 1 to 60.`);
    }
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
    const fees = LANGS.flatMap(l => [
      [`fee${LANGUAGES[l].suffix}`, LIMITS.fee],
      [`spot${LANGUAGES[l].suffix}`, LIMITS.spot],
      [`spotAnswer${LANGUAGES[l].suffix}`, LIMITS.spotAnswer],
      [`photoTip${LANGUAGES[l].suffix}`, LIMITS.photoTip],
      [`summary${LANGUAGES[l].suffix}`, LIMITS.summary],
    ] as const);
    for (const [field, max] of [['nameEn', LIMITS.name], ['nameAr', LIMITS.name], ['descriptionEn', LIMITS.description], ['descriptionAr', LIMITS.description], ...optional, ...fees] as const) {
      if ((p[field] ?? '').length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
    }
    if (p.hours) problems.push(...hoursProblems(p.hours).map(problem => `${label}: ${problem}`));
    if (p.tips) problems.push(...tipsProblems(p.tips).map(problem => `${label}: ${problem}`));
    problems.push(...builtProblems(p).map(problem => `${label}: ${problem}`));
    problems.push(...photoProblems(label, p.photo), ...photoAltProblems(label, p));
    if (p.gallery) {
      if (p.gallery.length > MAX_GALLERY) problems.push(`${label}: at most ${MAX_GALLERY} more photos.`);
      p.gallery.forEach((g, i) => {
        const which = `${label}, more photos ${i + 1}`;
        problems.push(...photoProblems(which, g), ...photoAltProblems(which, g));
        // Extra photos are uploads (built-in photos are one per place).
        if (!g.src.startsWith('/api/photo?')) problems.push(`${which}: must be an uploaded photo.`);
      });
      if (new Set(p.gallery.map(g => g.src)).size < p.gallery.length) problems.push(`${label}: the same photo is in More photos twice.`);
    }
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
  if (content.specialPeriods) problems.push(...periodProblems(content.specialPeriods, placeIds));
  if (content.help) problems.push(...helpProblems(content.help));
  if (content.notices) problems.push(...noticeProblems(content.notices, new Set(content.routes.map(r => r.id)), placeIds));
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
