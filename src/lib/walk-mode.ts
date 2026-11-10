// Helpers for "Start the walk": which stop to begin at, and which way the
// next stop is. Pure, so they're easy to test; the screen is WalkMode.tsx.

import type { Lang } from '../i18n/lang.js';

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

// French and Spanish: west is O (ouest, oeste).
const ROMANCE = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** "NE" / "شمال شرق" / "NO": the nearest of the eight compass points. */
export const compassPoint = (bearing: number, lang: Lang | boolean) => {
  // `true` / `false` (Arabic or not) still works for older callers.
  const l = lang === true ? 'ar' : lang === false ? 'en' : lang;
  return (l === 'ar' ? AR : l === 'fr' || l === 'es' ? ROMANCE : EN)[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
};

/**
 * How far to turn the direction arrow. With the phone's heading it points
 * the way to walk, relative to where the phone faces; without one it points
 * at the compass bearing, with north up.
 */
export const arrowRotation = (bearing: number, heading: number | null) =>
  heading === null ? bearing : (((bearing - heading) % 360) + 360) % 360;

/** Start at the first stop not yet visited (or skipped), or the first stop if all are. */
export function startIndex(stopIds: number[], visited: Set<number>, skipped: Set<number> = new Set()): number {
  const i = stopIds.findIndex(id => !visited.has(id) && !skipped.has(id));
  return i === -1 ? 0 : i;
}

/** The next stop after `from` that isn't skipped, as an index into `stopIds`; -1 when there's none. */
export function nextUnskipped(stopIds: number[], from: number, skipped: Set<number>): number {
  for (let i = from + 1; i < stopIds.length; i++) if (!skipped.has(stopIds[i])) return i;
  return -1;
}

/** "Almost there" fires once per stop, inside this distance but before arrival (30 m). */
export const APPROACH_METERS = 60;

/**
 * The stop to say "Almost there" for, if any: the next stop, when the visitor
 * is within APPROACH_METERS of it but not yet arrived, and it hasn't been
 * announced already. A fix less precise than the distance can't tell.
 */
export function approachAlert(
  next: { id: number } | null,
  meters: number | null,
  accuracy: number | null,
  announced: Set<number>,
  arriveMeters = 30,
): number | null {
  if (!next || meters === null || announced.has(next.id)) return null;
  if (accuracy !== null && accuracy > APPROACH_METERS) return null;
  return meters <= APPROACH_METERS && meters > arriveMeters ? next.id : null;
}

/**
 * "Play on arrival": whether arriving at a stop should start its audio guide.
 * Only when the visitor turned it on, once per stop, and never over another
 * guide that's playing, loading or paused.
 */
export function shouldAutoPlay(on: boolean, placeId: number, played: Set<number>, playerStatus: 'idle' | 'loading' | 'playing' | 'paused'): boolean {
  return on && !played.has(placeId) && playerStatus === 'idle';
}
