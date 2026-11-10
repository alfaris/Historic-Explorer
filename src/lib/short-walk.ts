// "Short walk": a route's must-see stops only, for visitors with an hour
// rather than three. The admin ticks Must-see on places; a route with at least
// two of them offers the switch. The list, the map and walk mode then show
// only those stops (cafés and other extras stay), with the walk's distance and
// time worked out for them. Visited marks, the passport and the finish screen
// still count the whole route. The switch is remembered per route on this
// device. The maths is pure; the store is localStorage, in step across tabs.

import { useSyncExternalStore } from 'react';

export { hasShortWalk, mustSeeStops, shortWalkPlaces, shortWalkStats, SHORT_WALK_MIN, walkedPlaces } from './short-walk-core';

// --- The switch, per route, on this device ---------------------------------

const KEY = 'cairo-walks:short-walk';

/** Stored route IDs, keeping only well-formed ones. */
export function parseRouteIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const value = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)) : []);
  } catch {
    return new Set();
  }
}

let ids: Set<string> | null = null;
const listeners = new Set<() => void>();
const read = () => {
  try {
    return parseRouteIds(window.localStorage.getItem(KEY));
  } catch {
    return new Set<string>();
  }
};
const current = () => (ids ??= typeof window === 'undefined' ? new Set() : read());
// This tab's changes not yet written (storage full or blocked): laid over the
// stored set, so another tab's routes are kept when a write works again.
const pending = new Map<string, boolean>();
const storageWorks = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) !== undefined;
  } catch {
    return false;
  }
};
const withPending = (base: Set<string>) => {
  const next = new Set(base);
  for (const [id, on] of pending) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
};

/** Turns the short walk on or off for this route. */
export function setShortWalk(routeId: string, on: boolean) {
  pending.set(routeId, on);
  const next = withPending(storageWorks() ? read() : current());
  ids = next;
  try {
    if (next.size) window.localStorage.setItem(KEY, JSON.stringify([...next].sort()));
    else window.localStorage.removeItem(KEY);
    pending.clear();
  } catch {
    // Kept until the page closes, and written with the next change that can be.
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (storageWorks()) ids = withPending(read());
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      ids = withPending(read());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY = new Set<string>();
/** The routes with the short walk on. Re-renders when they change. */
export const useShortWalks = () => useSyncExternalStore(subscribe, current, () => EMPTY);
