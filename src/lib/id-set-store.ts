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

  const write = (ids: Set<number>) => {
    try {
      window.localStorage.setItem(storageKey, serializeIds(ids));
    } catch {
      // Not saved; the in-memory state still updates.
    }
  };

  let ids: Set<number> | null = null;
  const listeners = new Set<() => void>();

  const current = () => (ids ??= typeof window === 'undefined' ? new Set<number>() : read());

  const update = (next: Set<number>) => {
    ids = next;
    write(next);
    listeners.forEach(listener => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Another tab changed the set. Re-read storage rather than trusting
    // e.newValue, which may be older than a change made since.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey || e.key === null) {
        ids = read();
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
  // read() is empty, so fall back to the in-memory set.
  const latest = () => (storageWorks() ? read() : current());

  return {
    toggle(id: number) {
      const next = new Set(latest());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next);
    },
    /** Adds the ID (no change if it's already there). */
    add(id: number) {
      const now = latest();
      if (now.has(id)) return;
      update(new Set([...now, id]));
    },
    remove(remove: number[]) {
      const next = new Set(latest());
      remove.forEach(id => next.delete(id));
      update(next);
    },
    /** The set. Re-renders when it changes. */
    useIds(): Set<number> {
      return useSyncExternalStore(subscribe, current, current);
    },
    /** The set now, outside React. */
    get: current,
  };
}
