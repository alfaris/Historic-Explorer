// The day each place was first marked visited (a Cairo date), for "My visits"
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
const save = (next: VisitDates) => {
  dates = next;
  try {
    window.localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(next));
  } catch {
    // Not kept after the page closes; still shown now.
  }
  listeners.forEach(l => l());
};
// Build on the latest saved dates, so another tab's aren't overwritten.
const latest = () => ({ ...current(), ...(typeof window === 'undefined' ? {} : read()) });

/** Records today's Cairo date for a place just marked visited (the first date is kept). */
export function recordVisitDate(id: number, at = new Date()) {
  const base = latest();
  if (base[id]) {
    if (!dates?.[id]) save(base);
    return;
  }
  save({ ...base, [id]: cairoDate(at) });
}

/** Forgets the dates of places no longer visited (unmarked, or a route walked again). */
export function forgetVisitDates(ids: number[]) {
  const base = latest();
  if (!ids.some(id => base[id])) return;
  const next = { ...base };
  for (const id of ids) delete next[id];
  save(next);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === VISIT_DATES_KEY || e.key === null) {
      dates = read();
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
