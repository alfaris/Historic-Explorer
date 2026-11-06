// What content is still missing: the admin's Content checklist, and the
// planned walk for the route editor. Pure, so it's easy to test.

import type { Content, Location, Route } from '../data/content';
import { photoForPlace } from '../data/photo-resolve';
import { LANGUAGES, OPTIONAL_LANGS, type OptionalLang } from '../i18n/lang';
import { walkPlan } from '../lib/walk';

export type Gap = 'photo' | 'hours' | OptionalLang;

/** Each item the checklist tracks, with the place editor section that fixes it. */
export const GAPS: { id: Gap; label: string; section: PlaceSection }[] = [
  { id: 'photo', label: 'Photo', section: 'photo' },
  { id: 'hours', label: 'Opening hours', section: 'hours' },
  ...OPTIONAL_LANGS.map(lang => ({ id: lang, label: LANGUAGES[lang].english, section: `lang-${lang}` as const })),
];

/** Sections of the place editor that can be scrolled to (element ids). */
export type PlaceSection = 'photo' | 'hours' | `lang-${OptionalLang}`;

const hasLang = (o: Record<string, unknown>, lang: OptionalLang, bases: string[]) =>
  bases.every(b => {
    const v = o[`${b}${LANGUAGES[lang].suffix}`];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '';
  });

/** What a place is missing: a photo (uploaded or built in), opening hours, or a language (name and description). */
export function placeGaps(place: Location): Gap[] {
  const gaps: Gap[] = [];
  if (!photoForPlace(place)) gaps.push('photo');
  if (!place.hours) gaps.push('hours');
  for (const lang of OPTIONAL_LANGS) {
    const needsDescription = !!place.descriptionEn?.trim();
    if (!hasLang(place as unknown as Record<string, unknown>, lang, needsDescription ? ['name', 'description'] : ['name'])) gaps.push(lang);
  }
  return gaps;
}

/** Languages a route is missing (name, description and highlights). */
export function routeGaps(route: Route): OptionalLang[] {
  return OPTIONAL_LANGS.filter(lang => !hasLang(route as unknown as Record<string, unknown>, lang, ['name', 'description', 'highlights']));
}

/** For each item: how many places have it, out of how many. */
export function progress(content: Content): { id: Gap; label: string; done: number; total: number }[] {
  const gaps = content.places.map(placeGaps);
  return GAPS.map(g => ({ id: g.id, label: g.label, done: gaps.filter(list => !list.includes(g.id)).length, total: content.places.length }));
}

/** The walk between a route's stops, in order (straight lines × the detour factor), as the walk plan has it. */
export function plannedWalk(places: Location[], routeId: string): { meters: number; minutes: number; stops: number } {
  const plan = walkPlan(places, routeId);
  let meters = 0;
  let minutes = 0;
  for (const info of plan.values()) {
    if (info.leg) {
      meters += info.leg.meters;
      minutes += info.leg.minutes;
    }
  }
  return { meters: Math.round(meters), minutes, stops: plan.size };
}

/** The planned walk as kilometres for the distance field, to one decimal place. */
export const plannedKm = (meters: number) => Math.round(meters / 100) / 10;
