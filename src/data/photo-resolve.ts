// Which photo to show: one uploaded in the admin dashboard (stored on the
// place or route) takes precedence over the built-in photo from photos.ts.

import { photos, type Photo } from './photos';
import type { Location, Route } from './locations';

export const photoForPlace = (place: Pick<Location, 'id' | 'photo'>): Photo | undefined =>
  place.photo ?? photos[`place-${place.id}`];

export const photoForRoute = (route: Pick<Route, 'id' | 'photo'>): Photo | undefined =>
  route.photo ?? photos[`route-${route.id}`];

/** Built-in photo only, ignoring any upload (shown in the admin editor). */
export const builtInPhoto = (key: string): Photo | undefined => photos[key];
