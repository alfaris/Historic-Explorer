// A place's extra photos in the editor: adding, moving and removing them. Pure.

import { MAX_GALLERY } from '../data/content';
import type { GalleryPhoto } from '../data/locations';
import { PHOTO_ALT_KEYS } from './PhotoAltFields';

/** The gallery with `photo` added at the end, unless it's full or already there. */
export const addToGallery = (gallery: GalleryPhoto[], photo: GalleryPhoto): GalleryPhoto[] =>
  gallery.length >= MAX_GALLERY || gallery.some(g => g.src === photo.src) ? gallery : [...gallery, photo];

/** The gallery with photo `i` moved one place earlier (-1) or later (+1). */
export function moveInGallery(gallery: GalleryPhoto[], i: number, by: -1 | 1): GalleryPhoto[] {
  const j = i + by;
  if (i < 0 || i >= gallery.length || j < 0 || j >= gallery.length) return gallery;
  const next = [...gallery];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removeFromGallery = (gallery: GalleryPhoto[], i: number): GalleryPhoto[] => gallery.filter((_, k) => k !== i);

/** Photo `i` with `patch` applied; empty description fields are removed. */
export function updateInGallery(gallery: GalleryPhoto[], i: number, patch: Partial<GalleryPhoto>): GalleryPhoto[] {
  return gallery.map((g, k) => {
    if (k !== i) return g;
    const next = { ...g, ...patch } as Record<string, unknown>;
    for (const key of PHOTO_ALT_KEYS) if (typeof next[key] === 'string' && !(next[key] as string).trim()) delete next[key];
    return next as unknown as GalleryPhoto;
  });
}

/** Gemini's descriptions for photo `i`, in the fields still empty (the admin may have typed meanwhile). */
export function fillGalleryAlts(gallery: GalleryPhoto[], i: number, src: string, texts: Partial<Record<string, string>>): GalleryPhoto[] {
  // The photo may have been moved or removed while Gemini was answering: match it by address.
  const k = gallery.findIndex(g => g.src === src);
  if (k < 0) return gallery;
  const empty = Object.fromEntries(PHOTO_ALT_KEYS.filter(key => texts[key]?.trim() && !gallery[k][key]?.trim()).map(key => [key, texts[key]]));
  return updateInGallery(gallery, k, empty);
}
