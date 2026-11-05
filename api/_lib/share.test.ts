import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../src/data/locations';
import { handleShare, withRoutePreview } from './share';

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

  it('serves the plain app for an unknown route', async () => {
    stubPage();
    const text = await (await handleShare(new Request('https://cairo.example/?route=nope'))).text();
    expect(text).toBe(HTML);
  });
});
