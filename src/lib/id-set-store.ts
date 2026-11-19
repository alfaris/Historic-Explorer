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
  const readRaw = () => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  // Changes this tab couldn't write (storage full): true for an ID added,
  // false for one removed. They're applied over what's stored, so the next
  // change here doesn't wipe them out, and written with the next save that
  // works. They hold only while the stored set is the one they were made over:
  // once another tab saves a change (perhaps marking the same place again),
  // the stored set is the truth and they're dropped.
  const unsaved = new Map<number, boolean>();
  let unsavedOver: string | null = null;
  const read = () => {
    const raw = readRaw();
    const stored = parseIds(raw);
    if (!unsaved.size) return stored;
    if (raw !== unsavedOver) {
      unsaved.clear();
      return stored;
    }
    for (const [id, added] of unsaved) {
      if (added) stored.add(id);
      else stored.delete(id);
    }
    return stored;
  };

  const write = (ids: Set<number>, changes: [number, boolean][]) => {
    try {
      window.localStorage.setItem(storageKey, serializeIds(ids));
      unsaved.clear();
    } catch {
      // Not saved; the in-memory state still updates, and the change is kept for the next save.
      if (!unsaved.size) unsavedOver = readRaw();
      for (const [id, added] of changes) unsaved.set(id, added);
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

  // Another tab saved the set. One listener for the store, attached when it's
  // made, so it's heard even while nothing on screen shows this set (its unsaved
  // changes must still be dropped). Re-read storage rather than trusting
  // e.newValue, which may be older than a change made since.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key !== storageKey && e.key !== null) return;
      // The stored set is the truth now, even if it reads the same as before
      // (the other tab unmarked and marked a place again).
      unsaved.clear();
      if (ids !== null) ids = read();
      listeners.forEach(listener => listener());
    });
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
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
  // read() is empty, so fall back to the in-memory set. read() puts this tab's
  // unsaved changes on top.
  const latest = () => (storageWorks() ? read() : current());

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
    /** Calls the listener when the set changes, here or in another tab; returns the unsubscribe. */
    subscribe,
    /** The latest saved set (another tab's changes included), or this tab's when storage can't be read. */
    latest,
  };
}
