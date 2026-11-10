// "Short walk": a route's must-see stops only, for visitors with an hour
// rather than three. The admin ticks Must-see on places; a route with at least
// two of them offers the switch. The list, the map and walk mode then show
// only those stops (cafés and other extras stay), with the walk's distance and
// time worked out for them. Visited marks, the passport and the finish screen
// still count the whole route. The switch is remembered per route on this
// device. The maths is pure; the store is localStorage, in step across tabs.

import { useSyncExternalStore } from 'react';
import { distanceMeters } from './geo';
import { DETOUR_FACTOR, STOP_CATEGORIES, walkMinutes, walkStops } from './walk';
import type { Point } from './geo';

type Place = Point & { id: number; routeId: string; category: string; mustSee?: boolean };

/** Fewer must-see stops than this, and the route has no short walk. */
export const SHORT_WALK_MIN = 2;

/** The route's must-see stops, in walking order. */
export const mustSeeStops = <T extends Place>(places: T[], routeId: string): T[] => walkStops(places, routeId).filter(p => p.mustSee);

/** Whether the route has a short walk (at least SHORT_WALK_MIN must-see stops). */
export const hasShortWalk = (places: Place[], routeId: string) => mustSeeStops(places, routeId).length >= SHORT_WALK_MIN;

/** The places with this route's other stops left out (its must-see stops, extras and other routes stay, in order). */
export const shortWalkPlaces = <T extends Place>(places: T[], routeId: string): T[] =>
  places.filter(p => p.routeId !== routeId || !STOP_CATEGORIES.has(p.category) || p.mustSee);

/**
 * The places as walked: on each route in `onFor` that has a short walk, its
 * other stops are left out. What "Continue your walk" picks the next stop
 * from, so it matches the walk it opens.
 */
export const walkedPlaces = <T extends Place>(places: T[], onFor: Set<string>): T[] =>
  [...onFor].filter(id => hasShortWalk(places, id)).reduce((ps, id) => shortWalkPlaces(ps, id), places);

/** The short walk's length (straight line × detour, to the nearest 100 m) and time, walking its stops in order. */
export function shortWalkStats(places: Place[], routeId: string): { stops: number; meters: number; minutes: number } {
  const stops = mustSeeStops(places, routeId);
  let straight = 0;
  let minutes = 0;
  for (let i = 1; i < stops.length; i++) {
    const d = distanceMeters(stops[i - 1], stops[i]);
    straight += d;
    minutes += walkMinutes(d);
  }
  return { stops: stops.length, meters: Math.round((straight * DETOUR_FACTOR) / 100) * 100, minutes };
}

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
