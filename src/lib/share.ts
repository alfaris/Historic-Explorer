// Links that open the app on a route. Shared links are `/r/<id>`: a path with
// no file behind it, so Vercel can send it to the link-preview function
// (vercel.json). `/?route=<id>` is understood too.

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
