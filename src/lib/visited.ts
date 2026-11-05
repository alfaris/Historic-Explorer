// Which places the visitor has marked as visited. Kept in this browser's
// localStorage, so it works offline and needs no account. Shared by every
// component through useVisited(), and kept in sync across open tabs.

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cairo-walks:visited';

/** Reads a stored value, ignoring anything malformed. */
export function parseVisited(raw: string | null): Set<number> {
  if (!raw) return new Set();
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0));
  } catch {
    return new Set();
  }
}

export const serializeVisited = (ids: Set<number>) => JSON.stringify([...ids].sort((a, b) => a - b));

// localStorage can be missing or throw (private mode, blocked storage);
// progress then lasts until the page is closed.
const read = () => {
  try {
    return parseVisited(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return new Set<number>();
  }
};

const write = (ids: Set<number>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeVisited(ids));
  } catch {
    // Not saved; the in-memory state still updates.
  }
};

let visited: Set<number> | null = null;
const listeners = new Set<() => void>();

const current = () => (visited ??= typeof window === 'undefined' ? new Set<number>() : read());

const update = (next: Set<number>) => {
  visited = next;
  write(next);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Another tab changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      visited = parseVisited(e.newValue);
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export function toggleVisited(id: number) {
  const next = new Set(current());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  update(next);
}

export function clearVisited(ids: number[]) {
  const next = new Set(current());
  ids.forEach(id => next.delete(id));
  update(next);
}

/** The set of visited place IDs. Re-renders when it changes. */
export function useVisited(): Set<number> {
  return useSyncExternalStore(subscribe, current, current);
}
