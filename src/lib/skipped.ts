// Stops the visitor chose to skip in walk mode (closed, crowded, not their
// thing). Kept on the device like visited places; "Walk again" clears a
// route's skips. A skip only changes the way through the walk: a route's
// passport stamp still needs every stop visited.

import { createIdSetStore } from './id-set-store';

const store = createIdSetStore('cairo-walks:skipped');

export const addSkipped = (id: number) => store.add(id);
export const removeSkipped = (ids: number[]) => store.remove(ids);
/** The set of skipped place IDs. Re-renders when it changes. */
export const useSkipped = () => store.useIds();
