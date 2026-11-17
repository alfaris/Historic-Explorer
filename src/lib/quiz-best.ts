// The best "Which came first?" score on each route, kept on this device only
// (like the passport stamps) and in sync across open tabs.

import { useSyncExternalStore } from 'react';

export interface Best {
  /** Right answers. */
  score: number;
  /** Rounds in that game. */
  of: number;
}
export type Bests = Record<string, Best>;

export const QUIZ_BEST_KEY = 'cairo-walks:quiz-best';
/** More rounds than a game can have means the stored value was tampered with. */
const MAX_ROUNDS = 20;

/** Stored scores, keeping only sensible ones (0 ≤ score ≤ rounds). */
export function parseBests(raw: string | null): Bests {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(([id, b]) => {
        const { score, of } = (b ?? {}) as Best;
        return id && Number.isInteger(score) && Number.isInteger(of) && of > 0 && of <= MAX_ROUNDS && score >= 0 && score <= of;
      }),
    ) as Bests;
  } catch {
    return {};
  }
}

/**
 * Whether `next` beats `old`: a better share of right answers, or the same
 * share over more rounds (4 of 4 beats 3 of 3). A route's rounds can change
 * when its places do, so shares are compared rather than bare scores.
 */
export function beats(next: Best, old: Best | undefined): boolean {
  if (!old) return true;
  const a = next.score * old.of;
  const b = old.score * next.of;
  return a > b || (a === b && next.of > old.of);
}

/** The best of both, route by route (for another tab's changes). */
export function mergeBests(a: Bests, b: Bests): Bests {
  const out: Bests = { ...a };
  for (const [id, best] of Object.entries(b)) if (beats(best, out[id])) out[id] = best;
  return out;
}

let bests: Bests | null = null;
const listeners = new Set<() => void>();
const read = (): Bests => {
  try {
    return parseBests(window.localStorage.getItem(QUIZ_BEST_KEY));
  } catch {
    return {};
  }
};
const current = () => (bests ??= typeof window === 'undefined' ? {} : read());

/**
 * Records a finished game. Returns whether it's a new best (the first game on
 * a route counts as one only when it scored something).
 */
export function recordScore(routeId: string, score: number, of: number): boolean {
  if (!(of > 0) || score < 0 || score > of) return false;
  const base = typeof window === 'undefined' ? current() : mergeBests(current(), read());
  const old = base[routeId];
  if (!beats({ score, of }, old)) {
    bests = base;
    return false;
  }
  bests = { ...base, [routeId]: { score, of } };
  try {
    window.localStorage.setItem(QUIZ_BEST_KEY, JSON.stringify(bests));
  } catch {
    // Not kept after the page closes; still shown now.
  }
  listeners.forEach(l => l());
  return old !== undefined || score > 0;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === QUIZ_BEST_KEY || e.key === null) {
      bests = mergeBests(current(), read());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useQuizBests = () => useSyncExternalStore(subscribe, current, () => ({}) as Bests);
