// What content is still missing: the admin's Content checklist, and the
// planned walk for the route editor. Pure, so it's easy to test.

import { glossaryOf, type Content, type Location, type Route } from '../data/content';
import { draftedOf } from '../lib/drafted';
import { photoForPlace } from '../data/photo-resolve';
import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang, type OptionalLang } from '../i18n/lang';
import { walkPlan } from '../lib/walk';
import type { GlossaryTerm } from '../lib/glossary';
import type { SpecialPeriod } from '../lib/special-hours';
import { eraOf } from '../lib/eras';

export type Gap = 'photo' | 'photoAlt' | 'hours' | 'era' | 'spot' | OptionalLang;

/** Each item the checklist tracks, with the place editor section that fixes it. */
export const GAPS: { id: Gap; label: string; section: PlaceSection }[] = [
  { id: 'photo', label: 'Photo', section: 'photo' },
  { id: 'photoAlt', label: 'Photo description', section: 'photo' },
  { id: 'hours', label: 'Opening hours', section: 'hours' },
  { id: 'era', label: 'Build date or era', section: 'built' },
  { id: 'spot', label: 'Spot it challenge', section: 'spot' },
  ...OPTIONAL_LANGS.map(lang => ({ id: lang, label: LANGUAGES[lang].english, section: `lang-${lang}` as const })),
];

/** Sections of the place editor that can be scrolled to (element ids). */
export type PlaceSection = 'photo' | 'hours' | 'built' | 'spot' | 'tips' | `lang-${OptionalLang}`;

const hasLang = (o: Record<string, unknown>, lang: OptionalLang, bases: string[]) =>
  bases.every(b => {
    const v = o[`${b}${LANGUAGES[lang].suffix}`];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '';
  });

/** Only monuments need a build date or era (not cafés, workshops and the like). */
const needsEra = (place: Location) => place.category === 'monument';

/** What a place is missing: a photo (uploaded or built in) or its description, opening hours, a build date or era (monuments), or a language (name and description). */
export function placeGaps(place: Location): Gap[] {
  const gaps: Gap[] = [];
  if (!photoForPlace(place)) gaps.push('photo');
  // A photo screen readers only know by the place's name.
  else if (!place.photoAltEn?.trim()) gaps.push('photoAlt');
  if (!place.hours) gaps.push('hours');
  if (needsEra(place) && !eraOf(place)) gaps.push('era');
  if (needsEra(place) && !place.spotEn?.trim()) gaps.push('spot');
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
    // The era and Spot it count only the places that need one (monuments).
    const applies = content.places.map(p => (g.id !== 'era' && g.id !== 'spot') || needsEra(p));
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

export type DraftKind = 'place' | 'route' | 'term' | 'period' | 'help' | 'notice';
export type DraftRow = { kind: DraftKind; id: string; name: string; keys: string[] };

/** The language a drafted field is in ("descriptionFr" is French). */
export function draftLang(key: string): Lang | undefined {
  return LANGS.find(l => key.endsWith(LANGUAGES[l].suffix));
}

/**
 * Everything Gemini drafted that no one has reviewed yet, item by item
 * (places, routes, glossary terms, special hours), optionally in one language.
 */
export function draftsToReview(content: Content, lang?: Lang): DraftRow[] {
  const rows: DraftRow[] = [];
  const add = (kind: DraftKind, id: string | number, name: string, item: object) => {
    const keys = draftedOf(item).filter(k => !lang || draftLang(k) === lang);
    if (keys.length) rows.push({ kind, id: String(id), name, keys });
  };
  content.places.forEach(p => add('place', p.id, p.nameEn, p));
  content.routes.forEach(r => add('route', r.id, r.nameEn, r));
  glossaryOf(content).forEach(t => add('term', t.id, t.termEn, t));
  (content.specialPeriods ?? []).forEach(p => add('period', p.id, p.nameEn, p));
  content.help?.contacts.forEach((c, i) => add('help', `contacts-${i}`, `Contact: ${c.nameEn}`, c));
  content.help?.tips.forEach((t, i) => add('help', `tips-${i}`, `Tip ${i + 1}`, t));
  content.help?.phrases.forEach((p, i) => add('help', `phrases-${i}`, `Phrase: ${p.meaningEn}`, p));
  content.notices?.forEach((n, i) => add('notice', i, `Notice ${i + 1}: ${n.textEn.slice(0, 50)}`, n));
  return rows;
}

/** The place editor section where a drafted field is. */
export function draftSection(key: string): PlaceSection | undefined {
  if (key.startsWith('photoAlt')) return 'photo';
  if (key.startsWith('spot') && (key.endsWith('En') || key.endsWith('Ar'))) return 'spot';
  const lang = draftLang(key);
  return lang === 'fr' || lang === 'es' ? `lang-${lang}` : undefined;
}

export type TranslationPriority = { lang: OptionalLang; pct: number; missing: number };

/**
 * The optional language most worth translating next: the one where visitors
 * meet the most missing places (its share of visitors × places missing it).
 * `shares` is each language's share of visitors in percent. Undefined when no
 * language with visitors is missing anything.
 */
export function translationPriority(items: { id: Gap; done: number; total: number }[], shares: Partial<Record<Lang, number>>): TranslationPriority | undefined {
  let best: (TranslationPriority & { weight: number }) | undefined;
  for (const lang of OPTIONAL_LANGS) {
    const item = items.find(i => i.id === lang);
    const pct = shares[lang] ?? 0;
    const missing = item ? item.total - item.done : 0;
    const weight = pct * missing;
    if (weight > 0 && (!best || weight > best.weight)) best = { lang, pct, missing, weight };
  }
  return best && { lang: best.lang, pct: best.pct, missing: best.missing };
}
