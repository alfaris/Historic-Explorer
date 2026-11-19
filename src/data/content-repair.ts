// How the admin repairs a saved copy that fails a check added since it was
// saved. Admin and server only: kept out of content.ts so visitors don't
// download it.

import { nextPlaceId, usableContent, validateContent, type Content } from './content.js';

// Compares two values ignoring key order (an editor may rebuild an object in another order).
const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

const withoutId = ({ id: _id, ...rest }: { id: unknown }) => stable(rest);

/** Problems found in `withIt` and not in `without`, counting repeats, compared by `key`. */
function extraProblems(withIt: string[], without: string[], key = (p: string) => p): string[] {
  const counts = new Map<string, number>();
  for (const p of without) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1);
  return withIt.filter(p => {
    const n = counts.get(key(p)) ?? 0;
    if (n > 0) counts.set(key(p), n - 1);
    return n === 0;
  });
}

/** Problems in `now` that `before` didn't have, ignoring the position of notices and Help items. */
export const newProblems = (now: string[], before: string[]) => extraProblems(now, before, unpositioned);

// Notices and Help items are named by position, so deleting or moving one renames those after it:
// compared without it, their older problems stay older. (A changed one is still checked on its own below.)
const unpositioned = (p: string) => p.replace(/^(Notice|Help (?:contact|tip|phrase)) \d+/, '$1');

const LIST_SECTIONS = ['glossary', 'specialPeriods', 'notices'] as const;

/**
 * What stops a save: an empty list means it may go ahead. Valid content
 * always may. Content that still has problems may too, so a saved copy
 * (`stored`) that fails a check added since it was saved can be fixed one
 * item at a time, if it has something to show (usableContent) and:
 * - no problem appears more often than in the saved copy;
 * - every place, route, glossary term, special period or notice it adds or
 *   changes passes its own checks (a renumbered repeat that is otherwise
 *   unchanged counts as unchanged);
 * - a list that grows gains no problem of its own (a count limit), and a changed Help passes its checks.
 * So a save can keep or remove older problems, never add one: not by
 * repeating one (more places outside Cairo) nor by editing an item that
 * already had one (a flagged photo address changed to another bad one).
 */
export function blockingProblems(next: Content, stored: Content): string[] {
  const problems = validateContent(next);
  if (problems.length === 0) return [];
  if (usableContent(next) === null) return problems;
  const added = extraProblems(problems, validateContent(stored), unpositioned);
  if (added.length) return added;

  const blocking: string[] = [];
  const unchanged = <T extends { id: unknown }>(item: T, old: T[]) =>
    old.some(o => o.id === item.id && stable(o) === stable(item)) || old.some(o => withoutId(o) === withoutId(item));
  for (const p of next.places) {
    if (!unchanged(p, stored.places)) blocking.push(...validateContent({ routes: next.routes, places: [p] }).filter(x => x.startsWith('Place ')));
  }
  for (const r of next.routes) {
    if (!unchanged(r, stored.routes)) blocking.push(...validateContent({ routes: [r], places: [] }).filter(x => x.startsWith('Route ')));
  }

  const base = { routes: next.routes, places: next.places };
  const baseProblems = validateContent(base);
  const sectionProblems = (key: string, value: unknown) => (value === undefined ? [] : extraProblems(validateContent({ ...base, [key]: value }), baseProblems));
  for (const key of LIST_SECTIONS) {
    const now = next[key] as unknown[] | undefined;
    const old = (stored[key] ?? []) as unknown[];
    if (!now || stable(now) === stable(stored[key])) continue;
    const before = new Set(old.map(stable));
    // A changed item with an ID (a special period, a glossary term) may keep the problems it had (deleting a
    // place edits each period that lists it); one without (a notice) must pass its checks.
    const byId = new Map(old.flatMap(o => (o && typeof o === 'object' && 'id' in o ? [[(o as { id: unknown }).id, o] as const] : [])));
    const own = now.map(item => {
      if (before.has(stable(item))) return [];
      const prior = item && typeof item === 'object' && 'id' in item ? byId.get((item as { id: unknown }).id) : undefined;
      return extraProblems(sectionProblems(key, [item]), prior === undefined ? [] : sectionProblems(key, [prior]));
    });
    blocking.push(...own.flat());
    if (now.length > old.length) {
      blocking.push(...extraProblems(sectionProblems(key, now), now.flatMap(item => sectionProblems(key, [item]))));
    }
  }
  if (stable(next.help) !== stable(stored.help)) blocking.push(...sectionProblems('help', next.help));
  return blocking;
}

/**
 * Gives every repeated place ID after the first a new one, and drops repeated routes, so the
 * admin's editors (which find, change and delete by ID) touch one item only.
 * A saved copy can have repeats only from before the check existed, or a
 * hand edit; visitors never see the repeats (usableContent). Returns what was
 * changed, for a notice. A repeated route is dropped instead: its places are the first one's.
 */
export function withUniqueIds(content: Content): { content: Content; changed: string[] } {
  const changed: string[] = [];
  // A repeated route can't have places of its own (places name their route by ID, so they show on the
  // first) and visitors never saw it: drop it rather than add an empty route. History keeps it.
  const routeIds = new Set<string>();
  const routes = content.routes.filter(r => {
    if (!routeIds.has(r.id)) return routeIds.add(r.id);
    changed.push(`Route "${r.nameEn || r.id}" repeated the ID "${r.id}" and had no places of its own; it's removed (History keeps it).`);
    return false;
  });
  let next = nextPlaceId(content);
  const placeIds = new Set<number>();
  const places = content.places.map(p => {
    if (!placeIds.has(p.id)) return placeIds.add(p.id), p;
    const id = next++;
    changed.push(`Place "${p.nameEn || p.id}" had a repeated ID; it's now ${id}.`);
    return { ...p, id };
  });
  return changed.length ? { content: { ...content, routes, places }, changed } : { content, changed };
}
