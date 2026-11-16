// The visitor's walking pace, kept on the device: relaxed (families, older
// visitors, a hot day), usual, or brisk. It scales every walking time the app
// shows (see walkMinutes); time spent at stops and distances stay the same.

import { useSyncExternalStore } from 'react';
import { setPaceFactor } from './walk';

export const PACES = ['relaxed', 'usual', 'brisk'] as const;
export type Pace = (typeof PACES)[number];
export const PACE_KEY = 'cw:pace';

/** How much longer (or shorter) each walk takes than at the usual 4.5 km/h. */
export const PACE_FACTOR: Record<Pace, number> = { relaxed: 1.3, usual: 1, brisk: 0.8 };

export const readPace = (stored: string | null): Pace => ((PACES as readonly string[]).includes(stored ?? '') ? (stored as Pace) : 'usual');

let pace: Pace | null = null;
const listeners = new Set<() => void>();

const current = (): Pace => {
  if (pace === null) {
    let stored: string | null = null;
    try {
      stored = typeof window === 'undefined' ? null : window.localStorage.getItem(PACE_KEY);
    } catch {
      // Private mode: the usual pace.
    }
    pace = readPace(stored);
    setPaceFactor(PACE_FACTOR[pace]);
  }
  return pace;
};

/** Sets the pace for every walking time in the app, and remembers it. */
export function setPace(next: Pace) {
  pace = next;
  setPaceFactor(PACE_FACTOR[next]);
  try {
    window.localStorage.setItem(PACE_KEY, next);
  } catch {
    // Not remembered; it still applies now.
  }
  listeners.forEach(l => l());
}

/**
 * The pace now. Components that show walking times call it, so they re-render
 * (and recompute memoized plans: add it to their dependencies) when it changes.
 */
export function usePace(): Pace {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => 'usual',
  );
}

/** Applies the stored pace before the first render. */
export const initPace = () => void current();
