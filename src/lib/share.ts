// Links that open the app on a route: `/?route=<id>`.

export const routeShareUrl = (origin: string, routeId: string) => `${origin}/?route=${encodeURIComponent(routeId)}`;

/** The route a `?route=` link points to, if it's one of these routes. */
export function routeFromSearch(search: string, routeIds: string[]): string | null {
  const id = new URLSearchParams(search).get('route');
  return id && routeIds.includes(id) ? id : null;
}
