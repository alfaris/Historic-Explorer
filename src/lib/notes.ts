// My notes: a short private note on any place ("come back at sunset"). Kept in
// this browser's localStorage only (no account, works offline), and in step
// across open tabs. A note on a place that's since been deleted is kept, just
// not shown, so it returns if the place does.

import { useSyncExternalStore } from 'react';

export const NOTE_MAX = 500;
const KEY = 'cairo-walks:notes';
export type Notes = Record<string, string>;

/** A stored set of notes, keeping only well-formed ones (place ID → text, within the limit). */
export function parseNotes(raw: string | null): Notes {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([id, text]) => /^\d{1,6}$/.test(id) && Number(id) > 0 && typeof text === 'string' && text.trim())
        .map(([id, text]) => [id, (text as string).slice(0, NOTE_MAX)]),
    );
  } catch {
    return {};
  }
}

/** The notes with this place's note set (cut to NOTE_MAX); an empty or blank note removes it. */
export function withNote(notes: Notes, id: number, text: string): Notes {
  const key = String(id);
  const next = { ...notes };
  if (text.trim()) next[key] = text.slice(0, NOTE_MAX);
  else delete next[key];
  return next;
}

let notes: Notes | null = null;
const listeners = new Set<() => void>();
const read = (): Notes => {
  try {
    return parseNotes(window.localStorage.getItem(KEY));
  } catch {
    return {};
  }
};
const current = () => (notes ??= typeof window === 'undefined' ? {} : read());
const storageWorks = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) !== undefined;
  } catch {
    return false;
  }
};
// This tab's edits not yet written (storage full or blocked for writing), by
// place: they're laid over the stored notes, so another tab's notes for other
// places are kept when a write works again.
const pending = new Map<number, string>();
const withPending = (base: Notes) => [...pending].reduce((n, [id, text]) => withNote(n, id, text), base);
// The latest notes: the stored ones (another tab may have changed them while
// nothing here was listening) with this tab's unsaved edits, or this tab's own
// when storage can't be read.
const latest = () => withPending(storageWorks() ? read() : current());

/** Sets (or, when empty, removes) this place's note. */
export function setNote(id: number, text: string) {
  pending.set(id, text);
  const next = latest();
  notes = next;
  try {
    if (Object.keys(next).length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
    pending.clear();
  } catch {
    // Not kept after the page closes; still shown now, and written with the next edit that can be.
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Changes made in another tab while nothing here was listening.
  const fresh = latest();
  if (JSON.stringify(fresh) !== JSON.stringify(current())) notes = fresh;
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      notes = withPending(read());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY: Notes = {};
/** All notes, by place ID. Re-renders when they change. */
export const useNotes = () => useSyncExternalStore(subscribe, current, () => EMPTY);
/** The notes now, outside React. */
export const notesNow = () => current();
