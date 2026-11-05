// Helpers for "Start the walk": which stop to begin at, and which way the
// next stop is. Pure, so they're easy to test; the screen is WalkMode.tsx.

import type { Point } from './geo';

/** Compass bearing from one point to another, in degrees clockwise from north (0–360). */
export function bearingDegrees(from: Point, to: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const φ1 = rad(from.lat);
  const φ2 = rad(to.lat);
  const Δλ = rad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const AR = ['شمالًا', 'شمال شرق', 'شرقًا', 'جنوب شرق', 'جنوبًا', 'جنوب غرب', 'غربًا', 'شمال غرب'];

const FR_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** "NE" / "شمال شرق" / "NO": the nearest of the eight compass points. */
export const compassPoint = (bearing: number, lang: 'en' | 'ar' | 'fr' | boolean) => {
  // `true` / `false` (Arabic or not) still works for older callers.
  const l = lang === true ? 'ar' : lang === false ? 'en' : lang;
  return (l === 'ar' ? AR : l === 'fr' ? FR_POINTS : EN)[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
};

/**
 * How far to turn the direction arrow. With the phone's heading it points
 * the way to walk, relative to where the phone faces; without one it points
 * at the compass bearing, with north up.
 */
export const arrowRotation = (bearing: number, heading: number | null) =>
  heading === null ? bearing : (((bearing - heading) % 360) + 360) % 360;

/** Start at the first stop not yet visited, or the first stop if all are. */
export function startIndex(stopIds: number[], visited: Set<number>): number {
  const i = stopIds.findIndex(id => !visited.has(id));
  return i === -1 ? 0 : i;
}
