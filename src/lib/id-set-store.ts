// A set of place IDs kept in this browser's localStorage, so it works offline
// and needs no account: visited places, saved places. Shared by every
// component through the store's hook, and kept in sync across open tabs.

import { useSyncExternalStore } from 'react';

/** Reads a stored value, ignoring anything malformed. */
export function parseIds(raw: string | null): Set<number> {
  if (!raw) return new Set();
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0));
  } catch {
    return new Set();
  }
}

export const serializeIds = (ids: Set<number>) => JSON.stringify([...ids].sort((a, b) => a - b));

export function createIdSetStore(storageKey: string) {
  // localStorage can be missing or throw (private mode, blocked storage);
  // the set then lasts until the page is closed.
  const read = () => {
    try {
      return parseIds(window.localStorage.getItem(storageKey));
    } catch {
      return new Set<number>();
    }
  };

  // Changes this tab couldn't write (storage full or blocked): true for an ID
  // added, false for one removed. They're applied over whatever is stored, so a
  // later change (or another tab's) doesn't wipe them out, and written with the
  // next save that works.
  const unsaved = new Map<number, boolean>();
  const withUnsaved = (base: Set<number>) => {
    if (!unsaved.size) return base;
    const out = new Set(base);
    for (const [id, added] of unsaved) {
      if (added) out.add(id);
      else out.delete(id);
    }
    return out;
  };

  const write = (ids: Set<number>, changes: [number, boolean][]) => {
    for (const [id, added] of changes) unsaved.set(id, added);
    try {
      window.localStorage.setItem(storageKey, serializeIds(ids));
      unsaved.clear();
    } catch {
      // Not saved; the in-memory state still updates, and the change is kept for the next save.
    }
  };

  let ids: Set<number> | null = null;
  const listeners = new Set<() => void>();

  const current = () => (ids ??= typeof window === 'undefined' ? new Set<number>() : read());

  const update = (next: Set<number>, changes: [number, boolean][]) => {
    ids = next;
    write(next, changes);
    listeners.forEach(listener => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Another tab changed the set. Re-read storage rather than trusting
    // e.newValue, which may be older than a change made since.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey || e.key === null) {
        ids = withUnsaved(read());
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  };

  const storageWorks = () => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(storageKey) !== undefined;
    } catch {
      return false;
    }
  };

  // Changes start from the latest saved set, not this tab's copy, so a change
  // made in another tab moments earlier isn't overwritten. Without storage,
  // read() is empty, so fall back to the in-memory set. This tab's unsaved
  // changes go on top.
  const latest = () => (storageWorks() ? withUnsaved(read()) : current());

  return {
    toggle(id: number) {
      const next = new Set(latest());
      const added = !next.has(id);
      if (added) next.add(id);
      else next.delete(id);
      update(next, [[id, added]]);
    },
    /** Adds the ID (no change if it's already there). Returns whether it was added, judged on the latest saved set. */
    add(id: number): boolean {
      const now = latest();
      if (now.has(id)) return false;
      update(new Set([...now, id]), [[id, true]]);
      return true;
    },
    remove(remove: number[]) {
      const next = new Set(latest());
      remove.forEach(id => next.delete(id));
      update(next, remove.map(id => [id, false]));
    },
    /** The set. Re-renders when it changes. */
    useIds(): Set<number> {
      return useSyncExternalStore(subscribe, current, current);
    },
    /** The set now, outside React. */
    get: current,
    /** The latest saved set (another tab's changes included), or this tab's when storage can't be read. */
    latest,
  };
}
