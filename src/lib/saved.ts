// Places the visitor has saved (bookmarked) to find again, across routes.
// Kept in this browser's localStorage (see id-set-store.ts), like visited
// places: offline, no account.

import { createIdSetStore } from './id-set-store';

const store = createIdSetStore('cairo-walks:saved');

export const toggleSaved = (id: number) => store.toggle(id);
export const removeSaved = (ids: number[]) => store.remove(ids);
/** The set of saved place IDs. Re-renders when it changes. */
export const useSaved = () => store.useIds();

/**
 * Saved places that still exist, grouped by route in the routes' order and,
 * within a route, in the places' order. Places deleted in the admin drop out.
 */
export function savedByRoute<P extends { id: number; routeId: string }, R extends { id: string }>(saved: Set<number>, places: P[], routes: R[]) {
  return routes
    .map(route => ({ route, places: places.filter(p => p.routeId === route.id && saved.has(p.id)) }))
    .filter(group => group.places.length > 0);
}
