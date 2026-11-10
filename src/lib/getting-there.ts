// "Getting there": where a route starts and how to reach it. Pure, so it
// works offline and is tested.

import type { Location, Route } from '../data/locations';
import { optionalText, type Lang } from '../i18n/lang';
import { walkStops } from './walk';

type Text = { text: string; lang: 'en' | undefined };

/** The place the walk starts from: the one the admin chose, else the first stop. */
export function startPlace<T extends Location>(route: Pick<Route, 'id' | 'startId'>, places: T[]): T | undefined {
  const chosen = route.startId !== undefined ? places.find(p => p.id === route.startId && p.routeId === route.id) : undefined;
  return chosen ?? walkStops(places, route.id)[0];
}

export type GettingThere<T> = { start: T; metro: Text | null; minutes: number | null; note: Text | null };

/** Everything the Getting there box shows, in the visitor's language (English where not translated). */
export function gettingThere<T extends Location>(route: Route, places: T[], lang?: Lang): GettingThere<T> | null {
  const start = startPlace(route, places);
  if (!start) return null;
  const metro = optionalText(route, 'metro', lang);
  const note = optionalText(route, 'gettingThere', lang);
  return {
    start,
    metro: metro.text ? metro : null,
    minutes: metro.text && route.metroMinutes ? route.metroMinutes : null,
    note: note.text ? note : null,
  };
}

/**
 * Getting there for a walk over some of the route's stops (the short walk):
 * when it starts at the route's own start, the same as gettingThere; when it
 * starts elsewhere, only that stop, since the metro, its walking time and the
 * note are written for the route's own start.
 */
export function gettingThereFor<T extends Location>(route: Route, places: T[], walkPlaces: T[], lang?: Lang): GettingThere<T> | null {
  const full = gettingThere(route, places, lang);
  const start = startPlace(route, walkPlaces);
  if (!start) return null;
  return full && full.start.id === start.id ? full : { start, metro: null, minutes: null, note: null };
}

/** Directions to the start in the phone's maps app, by taxi, metro or on foot (by coordinates, so the name's language doesn't matter). */
export const directionsUrl = (place: Pick<Location, 'lat' | 'lng'>) =>
  `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
