// Which photo to show: one uploaded in the admin dashboard (stored on the
// place or route) takes precedence over the built-in photo from photos.ts.

import { photos, type Photo } from './photos.js';
import type { Location, Route } from './locations';

export const photoForPlace = (place: Pick<Location, 'id' | 'photo'>): Photo | undefined =>
  place.photo ?? photos[`place-${place.id}`];

export const photoForRoute = (route: Pick<Route, 'id' | 'photo'>): Photo | undefined =>
  route.photo ?? photos[`route-${route.id}`];

/** Built-in photo only, ignoring any upload (shown in the admin editor). */
export const builtInPhoto = (key: string): Photo | undefined => photos[key];

/**
 * The 480px copy of a built-in photo (made by scripts/photo-variants.ts), for
 * srcset. Uploaded photos have only one size.
 */
export const smallPhotoSrc = (src: string) =>
  /^\/images\/photos\/[\w-]+\.webp$/.test(src) ? src.replace(/\.webp$/, '-480.webp') : null;

/** The 240px copy of a built-in photo, for list thumbnails (made by the same script). */
export const thumbPhotoSrc = (src: string) =>
  /^\/images\/photos\/[\w-]+\.webp$/.test(src) ? src.replace(/\.webp$/, '-240.webp') : null;
