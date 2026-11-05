// The editable content: routes and places. The admin dashboard edits it and
// the server stores it in Vercel Blob. The data in locations.ts is the
// starting point and the fallback whenever the live copy can't be loaded.
//
// Shared by the browser, the API functions and the tests, so it must not
// import anything browser- or server-specific.

import { categories, locations, routes, type Category, type Location, type Route } from './locations';

export type { Category, Location, Route };

export interface Content {
  routes: Route[];
  places: Location[];
}

export const bundledContent: Content = { routes, places: locations };

export const CATEGORY_IDS = categories.map(c => c.id) as Category[];

// Roughly Greater Cairo. Generous, but catches swapped lat/lng and typos.
export const CAIRO_BOUNDS = { minLat: 29.9, maxLat: 30.15, minLng: 31.1, maxLng: 31.4 };

const LIMITS = { name: 120, description: 2000, short: 60, highlights: 8 };

const hasArabic = (value: string) => /[؀-ۿ]/.test(value);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Copies only the known fields, trimmed and typed, so whatever a client sends
 * can't add unexpected properties to the stored content.
 */
export function normalizeContent(input: unknown): Content {
  const raw = (input ?? {}) as { routes?: unknown; places?: unknown };
  const routesIn = Array.isArray(raw.routes) ? raw.routes : [];
  const placesIn = Array.isArray(raw.places) ? raw.places : [];
  return {
    routes: routesIn.map((r: any): Route => ({
      id: str(r?.id),
      nameEn: str(r?.nameEn),
      nameAr: str(r?.nameAr),
      descriptionEn: str(r?.descriptionEn),
      descriptionAr: str(r?.descriptionAr),
      image: '',
      highlightsEn: Array.isArray(r?.highlightsEn) ? r.highlightsEn.map(str).filter(Boolean) : [],
      highlightsAr: Array.isArray(r?.highlightsAr) ? r.highlightsAr.map(str).filter(Boolean) : [],
      distance: str(r?.distance),
      duration: str(r?.duration),
    })),
    places: placesIn.map((p: any): Location => ({
      id: Number(p?.id),
      routeId: str(p?.routeId),
      nameEn: str(p?.nameEn),
      nameAr: str(p?.nameAr),
      category: str(p?.category) as Category,
      descriptionEn: str(p?.descriptionEn),
      descriptionAr: str(p?.descriptionAr),
      lat: Number(p?.lat),
      lng: Number(p?.lng),
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
    if (!r.distance || !r.duration) problems.push(`${label}: distance and duration are required.`);
    if (r.highlightsEn.length !== r.highlightsAr.length) problems.push(`${label}: English and Arabic highlights must have the same number of lines.`);
    if (r.highlightsEn.length > LIMITS.highlights) problems.push(`${label}: at most ${LIMITS.highlights} highlights.`);
    for (const [field, max] of [['nameEn', LIMITS.name], ['nameAr', LIMITS.name], ['descriptionEn', LIMITS.description], ['descriptionAr', LIMITS.description], ['distance', LIMITS.short], ['duration', LIMITS.short]] as const) {
      if (r[field].length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
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
    for (const [field, max] of [['nameEn', LIMITS.name], ['nameAr', LIMITS.name], ['descriptionEn', LIMITS.description], ['descriptionAr', LIMITS.description]] as const) {
      if ((p[field] ?? '').length > max) problems.push(`${label}: ${field} is longer than ${max} characters.`);
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
  return problems;
}

/** Next free place ID, for new places. */
export const nextPlaceId = (content: Content) => Math.max(0, ...content.places.map(p => p.id)) + 1;
