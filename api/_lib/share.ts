// Link previews for shared routes and places. `/r/<id>` and `/p/<id>` are
// rewritten here (see vercel.json; they have to be paths with no file behind
// them, because Vercel serves a real file such as index.html before any
// rewrite). The app's own index.html is returned with the title, description
// and photo as Open Graph / Twitter tags, so WhatsApp, iMessage and social
// sites show a proper card. People get the normal app either way.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { photoForPlace, photoForRoute } from '../../src/data/photo-resolve.js';
import type { Photo } from '../../src/data/photos.js';
import type { Location, Route } from '../../src/data/locations.js';
import { descriptionOf, nameOf, type Lang } from '../../src/i18n/lang.js';
import { getContent } from './content.js';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Preview = { title: string; description: string; url: string; photo: Photo | undefined; locale?: string };

const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', ar: 'ar_EG', fr: 'fr_FR' };

/** Adds the preview tags for a route to the app's HTML, and names the page after it. */
export function withRoutePreview(html: string, route: Route, origin: string): string {
  return withPreview(html, origin, {
    url: `${origin}/r/${encodeURIComponent(route.id)}`,
    title: `${route.nameEn} · ${route.nameAr} | Cairo Historic Explorer`,
    description: `${route.descriptionEn}. ${route.distance}, ${route.duration}. Self-guided walk with audio guides that work offline.`,
    photo: photoForRoute(route),
  });
}

// About two lines in a chat preview; cut at a word.
const short = (text: string, max = 200) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))}…`;
};

/**
 * Adds the preview tags for a place, in the given language, to the app's HTML.
 * `linkLang` is the language the link itself asked for, kept in the canonical
 * URL (null for a link without one, which shows English).
 */
export function withPlacePreview(html: string, place: Location, route: Route | undefined, origin: string, linkLang: Lang | null): string {
  const lang = linkLang ?? 'en';
  const tagline = lang === 'ar' ? 'جولة بدليل صوتي في القاهرة التاريخية' : lang === 'fr' ? 'Visite audioguidée du Caire historique' : 'Audio-guided walk in historic Cairo';
  return withPreview(html, origin, {
    url: `${origin}/p/${place.id}${linkLang ? `?lang=${linkLang}` : ''}`,
    title: `${nameOf(place, lang)}${route ? ` · ${nameOf(route, lang)}` : ''} | Cairo Historic Explorer`,
    description: short(descriptionOf(place, lang)) || tagline,
    photo: photoForPlace(place),
    locale: OG_LOCALE[lang],
  });
}

function withPreview(html: string, origin: string, { title, description, url, photo, locale }: Preview): string {
  const image = photo ? new URL(photo.src, origin).toString() : null;
  const tags = [
    ['og:type', 'website'],
    ...(locale ? [['og:locale', locale]] : []),
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

const asLang = (v: string | null): Lang | null => (v === 'en' || v === 'ar' || v === 'fr' ? v : null);

export async function handleShare(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const placeParam = url.searchParams.get('place');
  if (placeParam !== null) return handlePlace(url, placeParam);
  let html = await appHtml(url.origin);
  if (html === null) return Response.redirect(new URL(`/?route=${encodeURIComponent(url.searchParams.get('route') ?? '')}`, url.origin), 302);
  const id = url.searchParams.get('route');
  const route = id ? (await getContent()).routes.find(r => r.id === id) : undefined;
  if (route) html = withRoutePreview(html, route, url.origin);
  return htmlResponse(html);
}

/** `/p/<id>`: the app with the place's preview; the home page if there's no such place. */
async function handlePlace(url: URL, idParam: string): Promise<Response> {
  const id = /^\d{1,6}$/.test(idParam) ? Number(idParam) : NaN;
  const content = await getContent();
  const place = content.places.find(p => p.id === id);
  if (!place) return Response.redirect(new URL('/', url.origin), 302);
  const lang = asLang(url.searchParams.get('lang'));
  const html = await appHtml(url.origin);
  if (html === null) return Response.redirect(new URL(`/?loc=${place.id}${lang ? `&lang=${lang}` : ''}`, url.origin), 302);
  const route = content.routes.find(r => r.id === place.routeId);
  return htmlResponse(withPlacePreview(html, place, route, url.origin, lang));
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short CDN cache: previews follow admin edits within minutes.
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
