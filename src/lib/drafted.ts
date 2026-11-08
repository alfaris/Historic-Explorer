// Fields whose text Gemini drafted and no one has checked yet (names,
// descriptions, highlights, photo descriptions, Spot it, glossary, special
// hours). Kept on each item as `drafted: ['nameFr', …]` for the admin's
// review list; visitors never see it. Pure; shared by the app, the admin and
// the server.

export const DRAFTED_MAX = 60;
const KEY = /^[a-z][A-Za-z]{0,39}$/;
const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '');

/** The item's well-formed draft marks, only for fields that still have text. */
export function normalizeDrafted(o: any): { drafted?: string[] } {
  const raw: unknown[] = Array.isArray(o?.drafted) ? o.drafted : [];
  const keys = [...new Set(raw.filter((k): k is string => typeof k === 'string' && KEY.test(k) && k !== 'drafted'))]
    .filter(k => filled(o[k]))
    .slice(0, DRAFTED_MAX);
  return keys.length ? { drafted: keys } : {};
}

type Marked = { drafted?: string[] };

/** The item with these fields marked as drafted. */
export function withDrafted<T extends object>(item: T, keys: string[]): T {
  if (!keys.length) return item;
  const now = (item as Marked).drafted ?? [];
  const drafted = [...new Set([...now, ...keys])];
  return drafted.length === now.length ? item : ({ ...item, drafted } as T);
}

/** The item with these fields no longer marked (reviewed, or typed by hand). */
export function withoutDrafted<T extends object>(item: T, keys: string[]): T {
  const now = (item as Marked).drafted;
  if (!now?.some(k => keys.includes(k))) return item;
  const drafted = now.filter(k => !keys.includes(k));
  const next = { ...item } as T & Marked;
  if (drafted.length) next.drafted = drafted;
  else delete next.drafted;
  return next;
}

/** The fields marked as drafted. */
export const draftedOf = (item: object): string[] => (item as Marked).drafted ?? [];
