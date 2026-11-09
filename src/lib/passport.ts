// The Cairo passport: a stamp for each route walked to the end, with the
// date and the Spot it challenges found. Kept on this device only (no
// account), like visited places, and in sync across open tabs.

import { useSyncExternalStore } from 'react';
import { LANGUAGES, type Lang } from '../i18n/lang';

export interface Stamp {
  /** The day it was finished, in Cairo (YYYY-MM-DD). */
  date: string;
  /** Spot it challenges found on the route, and how many it has. */
  found: number;
  spots: number;
  /** When it was first finished (ms since 1970), to tell apart walks finished the same day. Absent on older stamps. */
  at?: number;
}
export type Stamps = Record<string, Stamp>;

const KEY = 'cairo-walks:passport';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);

/** Stored stamps, keeping only well-formed ones. */
export function parseStamps(raw: string | null): Stamps {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([id, s]) => id && s && typeof s === 'object' && DATE.test(String((s as Stamp).date)))
        .map(([id, s]) => {
          const { date, found, spots, at } = s as Stamp;
          return [id, { date, found: Math.min(count(found), count(spots)), spots: count(spots), ...(count(at) > 0 ? { at } : {}) }];
        }),
    );
  } catch {
    return {};
  }
}

/**
 * The stamps with this route's: the first finish keeps its date, and walking it
 * again only adds Spot it challenges found since.
 */
export function withStamp(stamps: Stamps, routeId: string, date: string, spot: { found: number; total: number }, at?: number): Stamps {
  const old = stamps[routeId];
  const stamp: Stamp = old
    ? { ...old, found: Math.max(old.found, Math.min(spot.found, spot.total)), spots: Math.max(old.spots, spot.total) }
    : { date, found: Math.min(spot.found, spot.total), spots: spot.total, ...(at ? { at } : {}) };
  if (old && old.found === stamp.found && old.spots === stamp.spots) return stamps;
  return { ...stamps, [routeId]: stamp };
}

/** How many of these routes have a stamp. */
export const stampCount = (stamps: Stamps, routes: { id: string }[]) => routes.filter(r => stamps[r.id]).length;

/** "8 Nov 2026" in the language, with Western digits in Arabic too, as the app writes its other numbers. */
export function stampDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : LANGUAGES[lang].locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

// The store, as for visited places: localStorage when it works, memory when it doesn't.
let stamps: Stamps | null = null;
const listeners = new Set<() => void>();
const read = (): Stamps => {
  try {
    return parseStamps(window.localStorage.getItem(KEY));
  } catch {
    return {};
  }
};
const current = () => (stamps ??= typeof window === 'undefined' ? {} : read());

/**
 * Both sets of stamps together: stamps are never taken away, so a route
 * stamped in either is stamped, with the earlier date and the most challenges.
 */
export function mergeStamps(a: Stamps, b: Stamps): Stamps {
  const out: Stamps = { ...a };
  for (const [id, s] of Object.entries(b)) {
    const o = out[id];
    if (!o) {
      out[id] = s;
      continue;
    }
    // The first finish: its date and, when it has one, its time.
    const first = s.date < o.date || (s.date === o.date && (s.at ?? Infinity) < (o.at ?? Infinity)) ? s : o;
    out[id] = { date: first.date, found: Math.max(o.found, s.found), spots: Math.max(o.spots, s.spots), ...(first.at ? { at: first.at } : {}) };
  }
  return out;
}

// Changes start from this tab's stamps together with the latest saved ones,
// so a stamp another tab added moments earlier isn't overwritten, and one this
// tab couldn't save (storage full or blocked) isn't dropped.
const latest = (): Stamps => (typeof window === 'undefined' ? current() : mergeStamps(current(), read()));

/** Adds (or updates) a route's stamp. */
export function stampRoute(routeId: string, date: string, spot: { found: number; total: number }) {
  const base = latest();
  const next = withStamp(base, routeId, date, spot, Date.now());
  if (next === base) {
    // Nothing new here, but another tab's stamps may be newer than this tab's copy.
    if (JSON.stringify(base) !== JSON.stringify(current())) {
      stamps = base;
      listeners.forEach(l => l());
    }
    return;
  }
  stamps = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept after the page closes; still shown now.
  }
  listeners.forEach(l => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      stamps = mergeStamps(current(), read());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

/** The stamps now, outside React. */
export const stampsNow = () => current();

export const useStamps = () => useSyncExternalStore(subscribe, current, () => ({}) as Stamps);
