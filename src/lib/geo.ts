// Distance and arrival logic for "Near me" mode. Pure functions, so they can
// be tested without a browser or GPS.

export interface Point {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest place to `from`, with its distance, or null if there are none. */
export function nearest<T extends Point>(from: Point, places: T[]): { place: T; meters: number } | null {
  let best: { place: T; meters: number } | null = null;
  for (const place of places) {
    const meters = distanceMeters(from, place);
    if (!best || meters < best.meters) best = { place, meters };
  }
  return best;
}

/** Within this distance of a place counts as arriving. */
export const ARRIVE_METERS = 30;
/** Further than this from the place you arrived at counts as having left. */
export const LEAVE_METERS = 60;
/** Ignore fixes less precise than this: they can't tell 30 m apart. */
export const MAX_ACCURACY_METERS = 50;

export interface ArrivalState {
  /** The place the visitor is currently at, if any. */
  atId: number | null;
}

/**
 * Decides whether a new position means arriving at a place. Returns the new
 * state and the id of a place just arrived at (to prompt once), or null.
 * Arrival needs <= ARRIVE_METERS; the visitor must then move beyond
 * LEAVE_METERS before the same place can trigger again, so GPS jitter at the
 * edge doesn't prompt repeatedly.
 */
export function updateArrival<T extends Point & { id: number }>(
  state: ArrivalState,
  position: Point & { accuracy: number },
  places: T[],
): { state: ArrivalState; arrivedId: number | null } {
  if (position.accuracy > MAX_ACCURACY_METERS) return { state, arrivedId: null };

  if (state.atId !== null) {
    const current = places.find(p => p.id === state.atId);
    if (current && distanceMeters(position, current) <= LEAVE_METERS) return { state, arrivedId: null };
  }

  const closest = nearest(position, places);
  if (closest && closest.meters <= ARRIVE_METERS) {
    return { state: { atId: closest.place.id }, arrivedId: closest.place.id };
  }
  return { state: { atId: null }, arrivedId: null };
}

/** "45 m" / "1.2 km", or the Arabic equivalent. */
export function formatDistance(meters: number, isArabic: boolean): string {
  const m = Math.max(5, Math.round(meters / 5) * 5);
  if (m < 1000) return isArabic ? `${m} م` : `${m} m`;
  const km = (meters / 1000).toFixed(meters < 10_000 ? 1 : 0);
  return isArabic ? `${km} كم` : `${km} km`;
}
