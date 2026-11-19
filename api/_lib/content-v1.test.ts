import { describe, expect, it, vi } from 'vitest';
import { bundledContent, normalizeContent, type Content } from '../../src/data/content';
import { DEFAULT_GLOSSARY } from '../../src/data/glossary';
import { LANGS, descriptionOf } from '../../src/i18n/lang';
import { audioGuideUrl } from '../../src/lib/offline-pack';
import { narrationSource } from '../../src/lib/guide-kind';

let served: Content = normalizeContent(structuredClone(bundledContent));
vi.mock('./content.js', () => ({ getContent: async () => served }));

const { MIN_APP_VERSION, SCHEMA_VERSION, contentV1, etagMatches, serializeV1 } = await import('./content-v1');
const { default: handler } = await import('../v1/content');

const get = (headers: Record<string, string> = {}) => handler.fetch(new Request('https://x/api/v1/content', { headers }));

describe('contentV1', () => {
  it('wraps the content with its schema, content and app versions', () => {
    const v1 = contentV1(served);
    expect(v1.schemaVersion).toBe(SCHEMA_VERSION);
    expect(v1.minAppVersion).toBe(MIN_APP_VERSION);
    expect(v1.content).toEqual({ ...served, glossary: DEFAULT_GLOSSARY });
    expect(v1.contentVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it('sends the built-in glossary until the admin saves one, and the admin\'s after', () => {
    expect(served.glossary).toBeUndefined();
    expect(contentV1(served).content.glossary).toEqual(DEFAULT_GLOSSARY);
    const own = [{ ...DEFAULT_GLOSSARY[0], defEn: 'Our own wording' }];
    const saved = contentV1({ ...served, glossary: own });
    expect(saved.content.glossary).toEqual(own);
    expect(saved.contentVersion).not.toBe(contentV1(served).contentVersion);
  });

  it('gives each place the same audio URLs the web builds, in every language with a description', () => {
    const { audio } = contentV1(served);
    for (const p of served.places) {
      for (const lang of LANGS) {
        const text = descriptionOf(p, lang);
        expect(audio[p.id][lang]).toBe(text ? audioGuideUrl(p.id, lang, narrationSource(p, lang, text)) : undefined);
      }
    }
  });

  it('changes the content version and the ETag when the content changes, and only then', () => {
    const a = serializeV1(served);
    expect(serializeV1(normalizeContent(structuredClone(served))).etag).toBe(a.etag);
    const edited = structuredClone(served);
    edited.places[0] = { ...edited.places[0], descriptionEn: edited.places[0].descriptionEn + ' Edited.' };
    const b = serializeV1(edited);
    expect(b.etag).not.toBe(a.etag);
    expect(contentV1(edited).contentVersion).not.toBe(contentV1(served).contentVersion);
    // An edited description gives that place new audio URLs, so old recordings aren't reused.
    expect(contentV1(edited).audio[edited.places[0].id].en).not.toBe(contentV1(served).audio[served.places[0].id].en);
  });

  it('changes the content version when only the audio URLs change (a new audio recipe)', () => {
    const before = contentV1(served);
    const after = contentV1(served, place => ({ en: `/api/audio-guide?id=${place.id}&lang=en&v=00000000` }));
    expect(after.content).toEqual(before.content);
    expect(after.contentVersion).not.toBe(before.contentVersion);
  });

  it('matches If-None-Match lists, weak validators and *', () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
    expect(etagMatches('"x", W/"abc"', '"abc"')).toBe(true);
    expect(etagMatches('*', '"abc"')).toBe(true);
    expect(etagMatches('"abcd"', '"abc"')).toBe(false);
    expect(etagMatches(null, '"abc"')).toBe(false);
  });
});

describe('GET /api/v1/content', () => {
  it('serves the envelope with an ETag and CDN caching', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect(res.headers.get('cache-control')).toContain('s-maxage=30');
    const body = await res.json();
    expect(body.schemaVersion).toBe(SCHEMA_VERSION);
    expect(body.content.places.length).toBe(served.places.length);
  });

  it('answers 304 with no body when the app already has this version, and 200 after a change', async () => {
    const etag = (await get()).headers.get('etag')!;
    const same = await get({ 'If-None-Match': etag });
    expect(same.status).toBe(304);
    expect(await same.text()).toBe('');
    expect(same.headers.get('etag')).toBe(etag);
    expect(same.headers.get('cache-control')).toBe('private, no-cache');
    served = { ...served, notices: [{ textEn: 'Closed for works', textAr: 'مغلق للصيانة' }] };
    const changed = await get({ 'If-None-Match': etag });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('etag')).not.toBe(etag);
  });
});
