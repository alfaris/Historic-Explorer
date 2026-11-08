// When a place was built, and in which era of Cairo's history: the label on a
// place's card, the list's era filter and "Through the ages". Pure; shared by
// the app, the admin and the server (content validation).

import type { Lang } from '../i18n/lang.js';

export const ERA_IDS = ['roman', 'early-islamic', 'tulunid', 'fatimid', 'ayyubid', 'mamluk', 'ottoman', 'modern'] as const;
export type EraId = (typeof ERA_IDS)[number];

export interface Era {
  id: EraId;
  /** The first year of the era (CE), for ordering and guessing an era from a year. */
  from: number;
  names: Record<Lang, string>;
}

/** Cairo's eras, oldest first. Years are approximate starts, as commonly given. */
export const ERAS: Era[] = [
  { id: 'roman', from: 1, names: { en: 'Roman & Coptic', ar: 'العصر الروماني والقبطي', fr: 'Époque romaine et copte', es: 'Época romana y copta' } },
  { id: 'early-islamic', from: 641, names: { en: 'Early Islamic', ar: 'صدر الإسلام', fr: 'Débuts de l’islam', es: 'Primeros siglos del islam' } },
  { id: 'tulunid', from: 868, names: { en: 'Tulunid', ar: 'العصر الطولوني', fr: 'Époque toulounide', es: 'Época tuluní' } },
  { id: 'fatimid', from: 969, names: { en: 'Fatimid', ar: 'العصر الفاطمي', fr: 'Époque fatimide', es: 'Época fatimí' } },
  { id: 'ayyubid', from: 1171, names: { en: 'Ayyubid', ar: 'العصر الأيوبي', fr: 'Époque ayyoubide', es: 'Época ayubí' } },
  { id: 'mamluk', from: 1250, names: { en: 'Mamluk', ar: 'العصر المملوكي', fr: 'Époque mamelouke', es: 'Época mameluca' } },
  { id: 'ottoman', from: 1517, names: { en: 'Ottoman', ar: 'العصر العثماني', fr: 'Époque ottomane', es: 'Época otomana' } },
  { id: 'modern', from: 1805, names: { en: 'Muhammad Ali & modern', ar: 'عصر محمد علي والعصر الحديث', fr: 'Méhémet Ali et époque moderne', es: 'Mehmet Alí y época moderna' } },
];

const BY_ID = new Map(ERAS.map(e => [e.id, e]));
export const isEraId = (v: unknown): v is EraId => typeof v === 'string' && BY_ID.has(v as EraId);
export const eraById = (id: EraId) => BY_ID.get(id)!;

/** Build years the content accepts (CE). */
export const YEAR_MIN = 1;
export const YEAR_MAX = 2100;

/** The fields a place may have. */
export interface BuiltFields {
  era?: EraId;
  /** The year building began, or the year it was built. */
  builtFrom?: number;
  /** The year it was finished, when different. */
  builtTo?: number;
}

/** The era a year falls in. */
export function eraForYear(year: number): EraId {
  let id: EraId = ERAS[0].id;
  for (const e of ERAS) if (year >= e.from) id = e.id;
  return id;
}

/** A place's era: the one set, or the one its build year falls in; null with neither. */
export const eraOf = (p: BuiltFields): EraId | null => p.era ?? (p.builtFrom ? eraForYear(p.builtFrom) : null);

const year = (v: unknown) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : undefined;
};

/** The well-formed build fields from untrusted input (a year "to" without a "from" is dropped). */
export function normalizeBuilt(input: { era?: unknown; builtFrom?: unknown; builtTo?: unknown } | null | undefined): BuiltFields {
  const out: BuiltFields = {};
  if (isEraId(input?.era)) out.era = input.era;
  const from = year(input?.builtFrom);
  const to = year(input?.builtTo);
  if (from !== undefined) {
    out.builtFrom = from;
    if (to !== undefined && to !== from) out.builtTo = to;
  }
  return out;
}

/** What's wrong with a place's build fields, for the admin. */
export function builtProblems(p: BuiltFields): string[] {
  const problems: string[] = [];
  const ok = (y: number) => y >= YEAR_MIN && y <= YEAR_MAX;
  if (p.builtFrom !== undefined && !ok(p.builtFrom)) problems.push(`build year must be from ${YEAR_MIN} to ${YEAR_MAX} (CE).`);
  if (p.builtTo !== undefined && !ok(p.builtTo)) problems.push(`"built until" year must be from ${YEAR_MIN} to ${YEAR_MAX} (CE).`);
  if (p.builtFrom !== undefined && p.builtTo !== undefined && p.builtTo < p.builtFrom) problems.push('"built until" is before the build year.');
  if (p.builtFrom === undefined && p.builtTo !== undefined) problems.push('"built until" needs a build year too.');
  return problems;
}

/** "1356–1363" or "1356"; null without a year. */
export const yearsText = (p: BuiltFields) =>
  p.builtFrom === undefined ? null : p.builtTo !== undefined ? `${p.builtFrom}–${p.builtTo}` : String(p.builtFrom);

/**
 * The line on a place's card: "Built 1356–1363 · Mamluk", "Built 1356",
 * or just the era. Null when the place has neither.
 */
export function builtLabel(p: BuiltFields, lang: Lang): string | null {
  const era = p.era ? eraById(p.era).names[lang] : null;
  const from = p.builtFrom;
  if (from === undefined) return era;
  const to = p.builtTo;
  const built = {
    en: to !== undefined ? `Built ${from}–${to}` : `Built ${from}`,
    ar: to !== undefined ? `بُني بين ${from} و${to}` : `بُني عام ${from}`,
    fr: to !== undefined ? `Construit de ${from} à ${to}` : `Construit en ${from}`,
    es: to !== undefined ? `Construido entre ${from} y ${to}` : `Construido en ${from}`,
  }[lang];
  return era ? `${built} · ${era}` : built;
}

export interface EraGroup<T> {
  era: Era;
  places: T[];
}

/**
 * "Through the ages": places grouped by era, oldest era first, and in date
 * order within each (undated ones last, by name). Places with no era or year
 * are left out.
 */
export function timeline<T extends BuiltFields & { id: number }>(places: T[], nameOf: (p: T) => string): EraGroup<T>[] {
  const groups = new Map<EraId, T[]>();
  for (const p of places) {
    const id = eraOf(p);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(p);
  }
  return ERAS.filter(e => groups.has(e.id)).map(era => ({
    era,
    places: groups.get(era.id)!.sort(
      (a, b) => (a.builtFrom ?? Infinity) - (b.builtFrom ?? Infinity) || nameOf(a).localeCompare(nameOf(b)) || a.id - b.id,
    ),
  }));
}
