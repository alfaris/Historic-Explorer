// "Duplicate" in the place editor: a new, unsaved place copied from an
// existing one (same route, category, hours, tips, fee, text), for adding a
// café or workshop much like one already there. What belongs to the original
// alone is left out: its photo and what it shows, its Spot it challenge and
// answer, and text Gemini drafted that no one has checked. Audio is kept by
// place ID, so the copy has none until it's made.

import type { Location } from '../data/locations';

/** How far the copy is moved each step (degrees, about 30 m north-east), so its pin isn't on top of another. */
export const COPY_OFFSET = 0.0002;

const DROPPED = /^(photo|image|photoAlt\w*|spot\w*|drafted)$/;
// Every place has these, so an unchecked draft of one stays, still marked for review.
const REQUIRED = new Set(['id', 'routeId', 'nameEn', 'nameAr', 'category', 'lat', 'lng']);
const withCopy = (name: string, suffix: string) => (name.trim() ? `${name.trim()} ${suffix}` : name);
const at = (deg: number) => +deg.toFixed(6);

/**
 * The copy of `place` with ID `id`. Its pin is moved COPY_OFFSET north-east,
 * or further, a step at a time, if one of `places` is already there (an
 * earlier copy), since two places can't share coordinates.
 */
export function duplicatePlace(place: Location, id: number, places: Pick<Location, 'lat' | 'lng'>[] = []): Location {
  const unchecked = new Set(place.drafted ?? []);
  const kept = Object.fromEntries(
    Object.entries(place).filter(([key]) => !DROPPED.test(key) && (!unchecked.has(key) || REQUIRED.has(key))),
  ) as Location;
  const stillDrafted = [...unchecked].filter(key => REQUIRED.has(key));
  const taken = new Set(places.map(p => `${p.lat},${p.lng}`));
  let step = 1;
  while (taken.has(`${at(place.lat + step * COPY_OFFSET)},${at(place.lng + step * COPY_OFFSET)}`)) step++;
  return {
    ...kept,
    ...(stillDrafted.length ? { drafted: stillDrafted } : {}),
    id,
    nameEn: withCopy(place.nameEn, '(copy)'),
    nameAr: withCopy(place.nameAr, '(نسخة)'),
    lat: at(place.lat + step * COPY_OFFSET),
    lng: at(place.lng + step * COPY_OFFSET),
  };
}
