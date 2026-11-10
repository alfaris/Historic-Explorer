// "Duplicate" in the place editor: a new, unsaved place copied from an
// existing one (same route, category, hours, tips, fee, text), for adding a
// café or workshop much like one already there. What belongs to the original
// alone is left out: its photo and what it shows, its Spot it challenge and
// answer, and unchecked Gemini drafts. Audio is kept by place ID, so the copy
// has none until it's made.

import type { Location } from '../data/locations';

/** How far the copy is moved (degrees, about 30 m north-east), so its pin isn't on top of the original's. */
export const COPY_OFFSET = 0.0002;

const DROPPED = /^(photo|image|photoAlt\w*|spot\w*|drafted)$/;
const withCopy = (name: string, suffix: string) => (name.trim() ? `${name.trim()} ${suffix}` : name);

export function duplicatePlace(place: Location, id: number): Location {
  const kept = Object.fromEntries(Object.entries(place).filter(([key]) => !DROPPED.test(key))) as Location;
  return {
    ...kept,
    id,
    nameEn: withCopy(place.nameEn, '(copy)'),
    nameAr: withCopy(place.nameAr, '(نسخة)'),
    lat: +(place.lat + COPY_OFFSET).toFixed(6),
    lng: +(place.lng + COPY_OFFSET).toFixed(6),
  };
}
