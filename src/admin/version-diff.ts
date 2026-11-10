// "What changed" in the History tab: the differences between two saved
// versions of the content, item by item. Places, routes, glossary terms and
// special hours are matched by ID: added, deleted, or edited with the fields
// that changed (old and new, long text shortened; a moved pin as a distance).
// Notices have no ID, so a changed one shows as one removed and one added.
// Unchanged items are left out. Pure.

import { glossaryOf, type Content } from '../data/content';
import { distanceMeters } from '../lib/geo';

/** Longer text is shortened to this many characters, with "…". */
export const TEXT_MAX = 80;

export type FieldChange = { field: string; before: string; after: string };
export type ItemChange =
  | { kind: 'added'; name: string }
  | { kind: 'deleted'; name: string }
  | { kind: 'edited'; name: string; fields: FieldChange[]; movedMeters?: number };
export type SectionChanges = { section: string; items: ItemChange[] };

/** A value as short readable text: "(empty)", the text itself, or JSON for lists and objects. */
export function shortValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  const text = typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
  return text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The fields that differ between two versions of one item, in a stable order. */
function fieldChanges(before: Record<string, unknown>, after: Record<string, unknown>, skip: Set<string>): FieldChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => !skip.has(k));
  return keys.filter(k => !same(before[k], after[k])).map(field => ({ field, before: shortValue(before[field]), after: shortValue(after[field]) }));
}

type Keyed = Record<string, unknown>;

function compareById<T extends Keyed>(before: T[], after: T[], key: (item: T) => string | number, name: (item: T) => string, located = false): ItemChange[] {
  const old = new Map(before.map(i => [key(i), i]));
  const now = new Map(after.map(i => [key(i), i]));
  const changes: ItemChange[] = [];
  for (const item of after) {
    const prev = old.get(key(item));
    if (!prev) {
      changes.push({ kind: 'added', name: name(item) });
      continue;
    }
    if (same(prev, item)) continue;
    const fields = fieldChanges(prev, item, new Set(located ? ['lat', 'lng'] : []));
    const p = prev as unknown as { lat: number; lng: number };
    const n = item as unknown as { lat: number; lng: number };
    const moved = located && (p.lat !== n.lat || p.lng !== n.lng) ? Math.round(distanceMeters(p, n)) : undefined;
    if (fields.length || moved !== undefined) changes.push({ kind: 'edited', name: name(item), fields, ...(moved !== undefined ? { movedMeters: moved } : {}) });
  }
  for (const item of before) if (!now.has(key(item))) changes.push({ kind: 'deleted', name: name(item) });
  return changes;
}

/** Notices, matched by their whole content (they have no ID). */
function compareNotices(before: Content['notices'] = [], after: Content['notices'] = []): ItemChange[] {
  const text = (n: unknown) => JSON.stringify(n);
  const old = new Set(before.map(text));
  const now = new Set(after.map(text));
  const name = (n: { textEn: string }) => shortValue(n.textEn);
  return [
    ...after.filter(n => !old.has(text(n))).map(n => ({ kind: 'added' as const, name: name(n) })),
    ...before.filter(n => !now.has(text(n))).map(n => ({ kind: 'deleted' as const, name: name(n) })),
  ];
}

/** What changed from `before` to `after`, by section; sections with no change are left out. */
export function versionDiff(before: Content, after: Content): SectionChanges[] {
  const sections: SectionChanges[] = [
    { section: 'Places', items: compareById(before.places as unknown as Keyed[], after.places as unknown as Keyed[], p => p.id as number, p => `${p.nameEn} (ID ${p.id})`, true) },
    { section: 'Routes', items: compareById(before.routes as unknown as Keyed[], after.routes as unknown as Keyed[], r => r.id as string, r => String(r.nameEn)) },
    // Content without a saved glossary uses the built-in one.
    { section: 'Glossary terms', items: compareById(glossaryOf(before) as unknown as Keyed[], glossaryOf(after) as unknown as Keyed[], t => t.id as string, t => String(t.termEn)) },
    { section: 'Special hours', items: compareById((before.specialPeriods ?? []) as unknown as Keyed[], (after.specialPeriods ?? []) as unknown as Keyed[], s => s.id as string, s => String(s.nameEn)) },
    { section: 'Notices', items: compareNotices(before.notices, after.notices) },
  ];
  if (!same(before.help, after.help)) {
    sections.push({ section: 'Help sheet', items: [{ kind: 'edited', name: 'Help sheet', fields: fieldChanges((before.help ?? {}) as Keyed, (after.help ?? {}) as Keyed, new Set()) }] });
  }
  return sections.filter(s => s.items.length > 0);
}

/** "3 changes" for a summary line. */
export const changeCount = (diff: SectionChanges[]) => diff.reduce((n, s) => n + s.items.length, 0);
