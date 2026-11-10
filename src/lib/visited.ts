// Which places the visitor has marked as visited. Kept in this browser's
// localStorage (see id-set-store.ts), so it works offline and needs no account.

import { createIdSetStore, parseIds, serializeIds } from './id-set-store';
import { removeSkipped } from './skipped';

const store = createIdSetStore('cairo-walks:visited');

/** Reads a stored value, ignoring anything malformed. */
export const parseVisited = parseIds;
export const serializeVisited = serializeIds;

// Visiting a stop, however it's marked (walk mode, its card, arriving with Near me), undoes a skip of it.
export const toggleVisited = (id: number) => {
  store.toggle(id);
  if (store.get().has(id)) removeSkipped([id]);
};
/** Marks a place visited (no change if it already is), undoing a skip of it. */
export const markVisited = (id: number) => {
  store.add(id);
  removeSkipped([id]);
};
export const clearVisited = (ids: number[]) => store.remove(ids);
/** The set of visited place IDs. Re-renders when it changes. */
export const useVisited = () => store.useIds();
