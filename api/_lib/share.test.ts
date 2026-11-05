import { afterEach, describe, expect, it, vi } from 'vitest';

// No built dist/index.html in tests (even if one exists locally): the fetch
// fallback is what runs.
vi.mock('node:fs/promises', () => ({ readFile: async () => { throw new Error('ENOENT'); } }));
import { locations, routes } from '../../src/data/locations';
import { handleShare, withPlacePreview, withRoutePreview } from './share';

const HTML = `<!doctype html><html><head>
    <meta name="description" content="Default." />
    <title>Cairo Historic Explorer</title>
  </head><body><div id="root"></div></body></html>`;

describe('withRoutePreview', () => {
  const route = routes.find(r => r.id === 'fustat-roda')!;
  const html = withRoutePreview(HTML, route, 'https://cairo.example');

  it('names the page after the route and adds preview tags', () => {
    expect(html).toContain('<title>Fustat, Roda &amp; Old Cairo · الفسطاط والروضة ومصر القديمة | Cairo Historic Explorer</title>');
    expect(html).toContain('<meta property="og:url" content="https://cairo.example/r/fustat-roda" />');
    expect(html).toContain('<meta property="og:image" content="https://cairo.example/images/photos/route-fustat-roda.webp" />');
    expect(html).toContain('summary_large_image');
    expect(html).toMatch(/<meta name="description" content="From the Nile palaces/);
    expect(html).not.toContain('content="Default."');
  });

  it('escapes route text', () => {
    const out = withRoutePreview(HTML, { ...route, nameEn: 'A "quoted" <b>name</b>' }, 'https://cairo.example');
    expect(out).toContain('A &quot;quoted&quot; &lt;b&gt;name&lt;/b&gt;');
    expect(out).not.toContain('<b>name</b>');
  });
});

describe('handleShare', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubPage = () => vi.stubGlobal('fetch', async (u: URL) => (String(u).endsWith('/index.html') ? new Response(HTML) : new Response('', { status: 404 })));

  it('serves the app with the route preview', async () => {
    stubPage();
    const res = await handleShare(new Request('https://cairo.example/?route=al-muizz'));
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('og:title" content="Al-Muizz Street Route');
  });

  it('never wraps a login or error page; sends the visitor to the app instead', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html><body>Log in to Vercel</body></html>'));
    const res = await handleShare(new Request('https://cairo.example/r/al-muizz?route=al-muizz'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://cairo.example/?route=al-muizz');
  });

  it('serves the plain app for an unknown route', async () => {
    stubPage();
    const text = await (await handleShare(new Request('https://cairo.example/?route=nope'))).text();
    expect(text).toBe(HTML);
  });
});

describe('withPlacePreview', () => {
  const place = locations[0];
  const route = routes.find(r => r.id === place.routeId);

  it('names the page after the place and its route, with its photo', () => {
    const html = withPlacePreview(HTML, place, route, 'https://cairo.example', 'en');
    expect(html).toContain(`<title>${place.nameEn} · ${route!.nameEn} | Cairo Historic Explorer</title>`);
    expect(html).toContain(`<meta property="og:url" content="https://cairo.example/p/${place.id}?lang=en" />`);
    // A link without a language shows English and keeps no language in its URL.
    expect(withPlacePreview(HTML, place, route, 'https://cairo.example', null)).toContain(`og:url" content="https://cairo.example/p/${place.id}" />`);
    expect(html).toContain('<meta property="og:locale" content="en_GB" />');
    expect(html).toContain(`content="https://cairo.example/images/photos/place-${place.id}.webp"`);
    expect(html).toMatch(/<meta name="description" content="The oldest mosque in Cairo/);
  });

  it('uses the link’s language, falling back to English for missing French', () => {
    const ar = withPlacePreview(HTML, place, route, 'https://cairo.example', 'ar');
    expect(ar).toContain(`<title>${place.nameAr} · ${route!.nameAr}`);
    expect(ar).toContain(`og:url" content="https://cairo.example/p/${place.id}?lang=ar"`);
    expect(ar).toContain('og:locale" content="ar_EG"');
    const fr = withPlacePreview(HTML, { ...place, nameFr: 'Mosquée Ibn Touloun' }, route, 'https://cairo.example', 'fr');
    expect(fr).toContain('<title>Mosquée Ibn Touloun · Parcours');
    expect(fr).toMatch(/<meta name="description" content="The oldest mosque/);
  });

  it('shortens long descriptions at a word', () => {
    const html = withPlacePreview(HTML, { ...place, descriptionEn: 'word '.repeat(100) }, route, 'https://cairo.example', 'en');
    const description = /<meta name="description" content="([^"]*)"/.exec(html)![1];
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description).toMatch(/word…$/);
  });
});

describe('handleShare for places', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubPage = () => vi.stubGlobal('fetch', async (u: URL) => (String(u).endsWith('/index.html') ? new Response(HTML) : new Response('', { status: 404 })));

  it('serves the app with the place preview in the link’s language', async () => {
    stubPage();
    const res = await handleShare(new Request(`https://cairo.example/api/share?place=${locations[0].id}&lang=ar`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(`og:title" content="${locations[0].nameAr}`);
  });

  it('sends unknown or malformed IDs to the home page', async () => {
    stubPage();
    for (const id of ['999999', 'abc', '']) {
      const res = await handleShare(new Request(`https://cairo.example/api/share?place=${id}`));
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://cairo.example/');
    }
  });

  it('opens the app on the place when the page can’t be wrapped, keeping the link’s language', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html><body>Log in to Vercel</body></html>'));
    const res = await handleShare(new Request(`https://cairo.example/api/share?place=${locations[0].id}&lang=fr`));
    expect(res.headers.get('location')).toBe(`https://cairo.example/?loc=${locations[0].id}&lang=fr`);
    const en = await handleShare(new Request(`https://cairo.example/api/share?place=${locations[0].id}&lang=en`));
    expect(en.headers.get('location')).toBe(`https://cairo.example/?loc=${locations[0].id}&lang=en`);
    const none = await handleShare(new Request(`https://cairo.example/api/share?place=${locations[0].id}`));
    expect(none.headers.get('location')).toBe(`https://cairo.example/?loc=${locations[0].id}`);
  });
});
