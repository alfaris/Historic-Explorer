// "Pins to check": stops far from every other place on their route, which
// usually means a mistyped or misplaced pin (it still passes the save check,
// which only rejects positions outside Cairo). The admin can confirm one as
// right; that's kept with the position, so moving the pin asks again. Pure.

import type { Content, Location } from '../data/content';
import { distanceMeters } from '../lib/geo';

/** Further than this from the nearest other place on its route, a pin is listed. */
export const PIN_FAR_METERS = 1000;

export type PinToCheck = { place: Location; meters: number };

/** Whether the admin confirmed this place's current position. */
export const pinConfirmed = (p: Location) => !!p.pinChecked && p.pinChecked.lat === p.lat && p.pinChecked.lng === p.lng;

/** Places more than PIN_FAR_METERS from the nearest other place on their route (and not confirmed), furthest first. */
export function pinsToCheck(content: Content): PinToCheck[] {
  const byRoute = new Map<string, Location[]>();
  for (const p of content.places) byRoute.set(p.routeId, [...(byRoute.get(p.routeId) ?? []), p]);
  const rows: PinToCheck[] = [];
  for (const place of content.places) {
    if (pinConfirmed(place)) continue;
    const others = (byRoute.get(place.routeId) ?? []).filter(o => o.id !== place.id);
    if (!others.length) continue;
    const meters = Math.min(...others.map(o => distanceMeters(place, o)));
    if (meters > PIN_FAR_METERS) rows.push({ place, meters: Math.round(meters) });
  }
  return rows.sort((a, b) => b.meters - a.meters);
}

/** The content with this place's current position confirmed as right. */
export const withPinConfirmed = (content: Content, id: number): Content => ({
  ...content,
  places: content.places.map(p => (p.id === id ? { ...p, pinChecked: { lat: p.lat, lng: p.lng } } : p)),
});

/** "1.8 km" or "850 m". */
export const distanceLabel = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 10) * 10} m`);
