// What content is still missing: the admin's Content checklist, and the
// planned walk for the route editor. Pure, so it's easy to test.

import type { Content, Location, Route } from '../data/content';
import { photoForPlace } from '../data/photo-resolve';
import { LANGUAGES, OPTIONAL_LANGS, type OptionalLang } from '../i18n/lang';
import { walkPlan } from '../lib/walk';
import type { GlossaryTerm } from '../lib/glossary';
import type { SpecialPeriod } from '../lib/special-hours';
import { eraOf } from '../lib/eras';

export type Gap = 'photo' | 'hours' | 'era' | OptionalLang;

/** Each item the checklist tracks, with the place editor section that fixes it. */
export const GAPS: { id: Gap; label: string; section: PlaceSection }[] = [
  { id: 'photo', label: 'Photo', section: 'photo' },
  { id: 'hours', label: 'Opening hours', section: 'hours' },
  { id: 'era', label: 'Build date or era', section: 'built' },
  ...OPTIONAL_LANGS.map(lang => ({ id: lang, label: LANGUAGES[lang].english, section: `lang-${lang}` as const })),
];

/** Sections of the place editor that can be scrolled to (element ids). */
export type PlaceSection = 'photo' | 'hours' | 'built' | `lang-${OptionalLang}`;

const hasLang = (o: Record<string, unknown>, lang: OptionalLang, bases: string[]) =>
  bases.every(b => {
    const v = o[`${b}${LANGUAGES[lang].suffix}`];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '';
  });

/** Only monuments need a build date or era (not cafés, workshops and the like). */
const needsEra = (place: Location) => place.category === 'monument';

/** What a place is missing: a photo (uploaded or built in), opening hours, a build date or era (monuments), or a language (name and description). */
export function placeGaps(place: Location): Gap[] {
  const gaps: Gap[] = [];
  if (!photoForPlace(place)) gaps.push('photo');
  if (!place.hours) gaps.push('hours');
  if (needsEra(place) && !eraOf(place)) gaps.push('era');
  for (const lang of OPTIONAL_LANGS) {
    const needsDescription = !!place.descriptionEn?.trim();
    if (!hasLang(place as unknown as Record<string, unknown>, lang, needsDescription ? ['name', 'description'] : ['name'])) gaps.push(lang);
  }
  return gaps;
}

/** Languages a route is missing: name and description, and highlights when it has English ones (as the editor's fill button asks). */
export function routeGaps(route: Route): OptionalLang[] {
  const fields = route.highlightsEn.length ? ['name', 'description', 'highlights'] : ['name', 'description'];
  return OPTIONAL_LANGS.filter(lang => !hasLang(route as unknown as Record<string, unknown>, lang, fields));
}

/** Languages a glossary term is missing: the term and its explanation. */
export const glossaryGaps = (term: GlossaryTerm): OptionalLang[] =>
  OPTIONAL_LANGS.filter(lang => !hasLang(term as unknown as Record<string, unknown>, lang, ['term', 'def']));

/** Languages a special-hours period is missing its name in. */
export const periodGaps = (period: SpecialPeriod): OptionalLang[] =>
  OPTIONAL_LANGS.filter(lang => !hasLang(period as unknown as Record<string, unknown>, lang, ['name']));

/** The empty `lang` fields of `obj` among `bases` whose English isn't empty, keyed by field (termFr, …), with the English to translate. */
export function missingText(obj: object, lang: OptionalLang, bases: string[]): Record<string, string> {
  const o = obj as Record<string, unknown>;
  const missing: Record<string, string> = {};
  for (const base of bases) {
    const key = `${base}${LANGUAGES[lang].suffix}`;
    const english = o[`${base}En`];
    if (!(typeof o[key] === 'string' && (o[key] as string).trim()) && typeof english === 'string' && english.trim()) missing[key] = english;
  }
  return missing;
}

/** For each item: how many places have it, out of how many. */
export function progress(content: Content): { id: Gap; label: string; done: number; total: number }[] {
  const gaps = content.places.map(placeGaps);
  return GAPS.map(g => {
    // The era counts only the places that need one.
    const applies = content.places.map(p => g.id !== 'era' || needsEra(p));
    return {
      id: g.id,
      label: g.label,
      done: gaps.filter((list, i) => applies[i] && !list.includes(g.id)).length,
      total: applies.filter(Boolean).length,
    };
  });
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
