// The day each place was last marked visited (a Cairo date), for "My visits"
// in the passport. Kept beside the visited set (visited.ts) in this browser's
// localStorage, so the set itself is stored as before. Places visited before
// dates were kept have none, and are listed under "Earlier".

import { useSyncExternalStore } from 'react';
import { cairoDate } from './special-hours';

export const VISIT_DATES_KEY = 'cairo-walks:visit-dates';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export type VisitDates = Record<string, string>;

/** Stored dates, keeping only a well-formed date for a well-formed place ID. */
export function parseVisitDates(raw: string | null): VisitDates {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([id, d]) => /^[1-9]\d{0,8}$/.test(id) && typeof d === 'string' && DATE.test(d))) as VisitDates;
  } catch {
    return {};
  }
}

export type VisitDay = { date: string | null; ids: number[] };

/**
 * The visited places by day, newest first, then those with no date ("Earlier").
 * Within a day, places keep the order of `order` (e.g. the content's).
 */
export function visitsByDay(visited: Set<number>, dates: VisitDates, order: number[]): VisitDay[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const ids = [...visited].filter(id => rank.has(id)).sort((a, b) => rank.get(a)! - rank.get(b)!);
  const days = new Map<string | null, number[]>();
  for (const id of ids) {
    const d = dates[id] ?? null;
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(id);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b.localeCompare(a)))
    .map(([date, list]) => ({ date, ids: list }));
}

// The store: localStorage when it works, memory when it doesn't.
let dates: VisitDates | null = null;
const listeners = new Set<() => void>();
const read = (): VisitDates => {
  try {
    return parseVisitDates(window.localStorage.getItem(VISIT_DATES_KEY));
  } catch {
    return {};
  }
};
const current = () => (dates ??= typeof window === 'undefined' ? {} : read());

// Changes this tab couldn't write (storage full or blocked): a date to set, or
// null to forget it. They're applied over whatever is stored, so they aren't
// lost when the stored dates are read again, and written with the next save
// that works.
const pending = new Map<string, string | null>();
// Whether a place is visited now (in the latest saved set): set by visited.ts.
let isVisited: (id: number) => boolean = () => true;
export const setVisitedCheck = (check: (id: number) => boolean) => {
  isVisited = check;
};
const withPending = (base: VisitDates): VisitDates => {
  if (!pending.size) return base;
  const out = { ...base };
  for (const [id, d] of pending) {
    // Another tab may have changed the visit since: a date is replayed only for a place
    // still visited, a forget only for one no longer visited (a re-marked place keeps its new date).
    if ((d !== null) !== isVisited(Number(id))) {
      pending.delete(id);
      continue;
    }
    if (d === null) delete out[id];
    else out[id] = d;
  }
  return out;
};

const save = (next: VisitDates, changes: [string, string | null][]) => {
  for (const [id, d] of changes) pending.set(id, d);
  dates = next;
  try {
    window.localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(next));
    pending.clear();
  } catch {
    // Not saved: kept for this visit, and written with the next save that works.
  }
  listeners.forEach(l => l());
};
const storageWorks = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(VISIT_DATES_KEY) !== undefined;
  } catch {
    return false;
  }
};
// Build on the saved dates when storage can be read (they're the truth: a date
// another tab removed stays removed), with this tab's unsaved changes on top;
// on this tab's copy only when storage can't be read.
const latest = (): VisitDates => (storageWorks() ? withPending(read()) : { ...current() });

/** Takes in what's stored now, keeping the same object when nothing changed (a stable snapshot for React). */
const refresh = () => {
  const next = latest();
  if (JSON.stringify(next) !== JSON.stringify(current())) {
    dates = next;
    return true;
  }
  return false;
};

/**
 * Records today's Cairo date for a place just marked visited (callers record
 * only a new visit). Any date already there is stale, left by a forget that
 * couldn't be saved, so it's replaced.
 */
export function recordVisitDate(id: number, at = new Date()) {
  const base = latest();
  const day = cairoDate(at);
  if (base[id] === day) {
    if (refresh()) listeners.forEach(l => l());
    return;
  }
  save({ ...base, [id]: day }, [[String(id), day]]);
}

/** Forgets the dates of places no longer visited (unmarked, or a route walked again). */
export function forgetVisitDates(ids: number[]) {
  const base = latest();
  if (!ids.some(id => base[id])) {
    if (refresh()) listeners.forEach(l => l());
    return;
  }
  const next = { ...base };
  for (const id of ids) delete next[id];
  save(next, ids.map(id => [String(id), null]));
}

const subscribe = (listener: () => void) => {
  // Dates another tab changed while nothing here was listening (the passport closed).
  refresh();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === VISIT_DATES_KEY || e.key === null) {
      // Another tab's dates, with this tab's unsaved changes on top.
      dates = withPending(read());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useVisitDates = () => useSyncExternalStore(subscribe, current, () => ({}) as VisitDates);
