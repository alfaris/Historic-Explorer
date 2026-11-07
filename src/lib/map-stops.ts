// The main map's walking order: an arrow at the middle of each leg between
// consecutive stops, pointing the way to walk. Pure, so it's tested.

import type { Point } from './geo';
import { bearingDegrees } from './walk-mode';

/** One arrow per leg: at its midpoint, turned to the compass bearing from one stop to the next. */
export function legArrows(stops: Point[]): { lat: number; lng: number; bearing: number }[] {
  const out: { lat: number; lng: number; bearing: number }[] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a.lat === b.lat && a.lng === b.lng) continue;
    out.push({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, bearing: Math.round(bearingDegrees(a, b)) });
  }
  return out;
}
