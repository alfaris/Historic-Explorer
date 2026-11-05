// Link previews for shared routes. `/r/<id>` is rewritten here (see
// vercel.json; it has to be a path with no file behind it, because Vercel
// serves a real file such as index.html before any rewrite). The app's own
// index.html is returned with the route's title,
// description and photo as Open Graph / Twitter tags, so WhatsApp, iMessage and
// social sites show a proper card. People get the normal app either way.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { photoForRoute } from '../../src/data/photo-resolve.js';
import type { Route } from '../../src/data/locations.js';
import { getContent } from './content.js';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Adds the preview tags for a route to the app's HTML, and names the page after it. */
export function withRoutePreview(html: string, route: Route, origin: string): string {
  const url = `${origin}/r/${encodeURIComponent(route.id)}`;
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

/**
 * The app's built index.html. vercel.json bundles dist/index.html with this
 * function, so it's read from disk. Fetching it from the site is the fallback,
 * but a deployment behind Vercel Authentication (previews) answers that with
 * its login page, so the protection-bypass secret is sent when there is one.
 */
async function appHtml(origin: string): Promise<string | null> {
  try {
    return await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
  } catch {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const res = await fetch(new URL('/index.html', origin), bypass ? { headers: { 'x-vercel-protection-bypass': bypass } } : {});
    const text = res.ok ? await res.text() : '';
    // Only the app's own page, never a login or error page.
    return text.includes('<div id="root">') ? text : null;
  }
}

export async function handleShare(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let html = await appHtml(url.origin);
  if (html === null) return Response.redirect(new URL(`/?route=${encodeURIComponent(url.searchParams.get('route') ?? '')}`, url.origin), 302);
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
