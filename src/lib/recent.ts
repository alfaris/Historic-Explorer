// Recently viewed places: the last places whose card the visitor opened,
// newest first. Kept in this browser's localStorage only (no account, works
// offline), and in step across open tabs.

import { useSyncExternalStore } from 'react';

export const RECENT_MAX = 10;
const KEY = 'cairo-walks:recent';

/** A stored list, keeping only well-formed IDs, without repeats, at most RECENT_MAX. */
export function parseRecent(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** The list with this place first (moved up if it was already there), at most RECENT_MAX. */
export const withRecent = (list: number[], id: number) => [id, ...list.filter(x => x !== id)].slice(0, RECENT_MAX);

/** The places in the list that still exist, in its order. */
export function recentPlaces<P extends { id: number }>(ids: number[], places: P[]): P[] {
  const byId = new Map(places.map(p => [p.id, p]));
  return ids.map(id => byId.get(id)).filter((p): p is P => !!p);
}

let list: number[] | null = null;
const listeners = new Set<() => void>();
const read = () => {
  try {
    return parseRecent(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
};
const current = () => (list ??= typeof window === 'undefined' ? [] : read());
const storageWorks = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) !== undefined;
  } catch {
    return false;
  }
};
// Set when the last write failed (storage full or blocked for writing): the
// stored list is then older than this tab's, which is kept until the page closes.
let unsaved = false;
// The latest list: the stored one when storage works (another tab may have
// changed it while nothing here was listening), else this tab's own.
const latest = () => (storageWorks() && !unsaved ? read() : current());
const EMPTY: number[] = [];

function save(next: number[]) {
  list = next;
  try {
    if (next.length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
    unsaved = false;
  } catch {
    // Not kept after the page closes; still shown now.
    unsaved = true;
  }
  listeners.forEach(l => l());
}

/** Notes that the visitor opened this place's card. */
export function addRecent(id: number) {
  const now = latest();
  if (now[0] === id && current()[0] === id) return;
  save(withRecent(now, id));
}

/** Forgets every recently viewed place. */
export const clearRecent = () => save([]);

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Changes made in another tab while nothing here was listening.
  list = latest();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      list = read();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The recently viewed place IDs now, outside React. */
export const recentNow = () => current();

/** The recently viewed place IDs, newest first. Re-renders when they change. */
export const useRecent = () => useSyncExternalStore(subscribe, current, () => EMPTY);
