// Links that open the app on a route or a place. Shared links are `/r/<id>`
// and `/p/<id>`: paths with no file behind them, so Vercel can send them to
// the link-preview function (vercel.json). `/?route=<id>` and `/?loc=<id>`
// are understood too.

export const routeShareUrl = (origin: string, routeId: string) => `${origin}/r/${encodeURIComponent(routeId)}`;

/** The route a `/r/<id>` or `?route=<id>` link points to, if it's one of these routes. */
export function routeFromLocation(loc: { pathname: string; search: string }, routeIds: string[]): string | null {
  const fromPath = /^\/r\/([^/]+)\/?$/.exec(loc.pathname)?.[1];
  const id = fromPath ? decodeURIComponent(fromPath) : new URLSearchParams(loc.search).get('route');
  return id && routeIds.includes(id) ? id : null;
}

/** Whether the address is a route link (resolved or not). */
export const isRouteLink = (loc: { pathname: string; search: string }) =>
  /^\/r\//.test(loc.pathname) || new URLSearchParams(loc.search).has('route');

/** A link to a place. `lang` (other than English) asks for the preview, and the app, in that language. */
export const placeShareUrl = (origin: string, placeId: number, lang?: string) =>
  `${origin}/p/${placeId}${lang && lang !== 'en' ? `?lang=${encodeURIComponent(lang)}` : ''}`;

/** The place ID a `/p/<id>` or `?loc=<id>` link points to (whether or not it exists). */
export function placeFromLocation(loc: { pathname: string; search: string }): number | null {
  const fromPath = /^\/p\/(\d{1,6})\/?$/.exec(loc.pathname)?.[1];
  const raw = fromPath ?? new URLSearchParams(loc.search).get('loc');
  const id = raw && /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Whether the address is a place link (resolved or not). */
export const isPlaceLink = (loc: { pathname: string; search: string }) =>
  /^\/p\//.test(loc.pathname) || new URLSearchParams(loc.search).has('loc');
