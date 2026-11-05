// Link previews for shared routes. `/?route=<id>` is rewritten here (see
// vercel.json): the app's own index.html is returned with the route's title,
// description and photo as Open Graph / Twitter tags, so WhatsApp, iMessage and
// social sites show a proper card. People get the normal app either way.

import { photoForRoute } from '../../src/data/photo-resolve.js';
import type { Route } from '../../src/data/locations.js';
import { getContent } from './content.js';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Adds the preview tags for a route to the app's HTML, and names the page after it. */
export function withRoutePreview(html: string, route: Route, origin: string): string {
  const url = `${origin}/?route=${encodeURIComponent(route.id)}`;
  const title = `${route.nameEn} · ${route.nameAr} | Cairo Historic Explorer`;
  const description = `${route.descriptionEn}. ${route.distance}, ${route.duration}. Self-guided walk with audio guides that work offline.`;
  const photo = photoForRoute(route);
  const image = photo ? new URL(photo.src, origin).toString() : null;
  const tags = [
    ['og:type', 'website'],
    ['og:site_name', 'Cairo Historic Explorer'],
    ['og:title', title],
    ['og:description', description],
    ['og:url', url],
    ...(image ? [['og:image', image], ['og:image:width', String(photo!.width)], ['og:image:height', String(photo!.height)]] : []),
  ]
    .map(([p, c]) => `<meta property="${p}" content="${escapeHtml(c)}" />`)
    .concat([
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
      `<link rel="canonical" href="${escapeHtml(url)}" />`,
    ])
    .join('\n    ');
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

export async function handleShare(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = await fetch(new URL('/index.html', url.origin));
  if (!page.ok) return new Response('Not found', { status: 404 });
  let html = await page.text();
  const id = url.searchParams.get('route');
  const route = id ? (await getContent()).routes.find(r => r.id === id) : undefined;
  if (route) html = withRoutePreview(html, route, url.origin);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short CDN cache: previews follow admin edits within minutes.
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
