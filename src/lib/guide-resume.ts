// Where the visitor got to in each recorded audio guide, kept in this
// browser so a guide cut short (place closed, app killed, phone call) can
// pick up from there. Keyed by the guide's key (place, language and narration
// version), so a regenerated narration starts afresh.

import { useSyncExternalStore } from 'react';

export const RESUME_KEY = 'cw:guide-resume';
/** Stopped in the first few seconds: not worth offering to resume. */
export const MIN_SECONDS = 5;
/** This close to the end counts as listened to the end. */
export const END_MARGIN = 5;
/** How many guides are remembered; the oldest go first. */
export const MAX_ENTRIES = 30;

export interface ResumePoint {
  key: string;
  /** Seconds into the recording. */
  at: number;
  /** When it was saved (ms), to keep the most recent. */
  saved: number;
}

export function parsePoints(raw: string | null): ResumePoint[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (p): p is ResumePoint =>
        !!p && typeof p.key === 'string' && p.key.length > 0 && Number.isFinite(p.at) && p.at > 0 && Number.isFinite(p.saved),
    );
  } catch {
    return [];
  }
}

/**
 * The points with this guide's position recorded: dropped if it's near the
 * start or the end, otherwise saved as the newest, keeping MAX_ENTRIES.
 */
export function withPosition(points: ResumePoint[], key: string, at: number, duration: number, now: number): ResumePoint[] {
  const rest = points.filter(p => p.key !== key);
  const nearEnd = Number.isFinite(duration) && duration > 0 && at >= duration - END_MARGIN;
  if (!Number.isFinite(at) || at < MIN_SECONDS || nearEnd) return rest;
  return [{ key, at: Math.floor(at), saved: now }, ...rest].sort((a, b) => b.saved - a.saved).slice(0, MAX_ENTRIES);
}

export const resumePoint = (points: ResumePoint[], key: string) => points.find(p => p.key === key)?.at ?? null;

/** "1:42", or "1:02:05" for an hour or more. */
export function clockLabel(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// The store. localStorage can be missing or throw (private mode); then the
// points last until the page closes, and are kept in memory if a write fails.
let memory: ResumePoint[] | null = null;
const listeners = new Set<() => void>();

const read = (): ResumePoint[] | null => {
  try {
    return parsePoints(window.localStorage.getItem(RESUME_KEY));
  } catch {
    return null;
  }
};

const current = () => (memory ??= typeof window === 'undefined' ? [] : read() ?? []);

// Positions this tab couldn't write yet, applied over whatever is stored.
const pending = new Map<string, { at: number; duration: number; saved: number }>();
const withPending = (base: ResumePoint[]) =>
  [...pending].reduce((points, [key, p]) => withPosition(points, key, p.at, p.duration, p.saved), base);

/** Saves how far into a guide the visitor got (or forgets it, near the start or end). */
export function savePosition(key: string, at: number, duration: number) {
  pending.delete(key);
  pending.set(key, { at, duration, saved: Date.now() });
  // Build on the latest stored points, so another tab's change isn't lost.
  const stored = typeof window === 'undefined' ? null : read();
  const before = resumePoint(current(), key);
  const next = withPending(stored ?? current());
  memory = next;
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(next));
    pending.clear();
  } catch {
    // Not saved: kept for this visit, and written with the next save that works.
  }
  if (before !== resumePoint(next, key)) listeners.forEach(fn => fn());
}

/** The points now, outside React. */
export const pointsNow = () => current();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === RESUME_KEY || e.key === null) {
      const stored = read();
      // Another tab saved: its points, with this tab's unsaved ones on top.
      if (stored) memory = withPending(stored);
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};

/** Seconds into this guide to resume from, or null. Re-renders when it changes. */
export function useResumePoint(key: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => resumePoint(current(), key),
    () => null,
  );
}
