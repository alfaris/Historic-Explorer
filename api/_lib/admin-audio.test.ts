import { beforeEach, describe, expect, it, vi } from 'vitest';
import { locations } from '../../src/data/locations';
import { textHash } from '../../src/lib/text-hash';

// Stand-ins for stored content, Blob audio and Gemini.
const stored = new Set<string>();
let generated: string[] = [];
let places = locations.map(l => ({ ...l }));

vi.mock('./content.js', () => ({
  getContentWithEtag: async () => ({ content: { routes: [], places }, etag: 'e' }),
}));
vi.mock('./gemini.js', async () => {
  const { descriptionOf } = await import('../../src/i18n/lang');
  type P = { id: number; nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string; descriptionFr?: string };
  return {
    audioStatus: async (p: P, lang: 'en' | 'ar' | 'fr') => {
      const text = descriptionOf(p, lang);
      if (!text) return 'no-text';
      return stored.has(`${lang}:${text}`) ? 'stored' : 'missing';
    },
    generateAndStoreAudio: async (p: P, lang: 'en' | 'ar' | 'fr') => {
      generated.push(`${p.id}:${lang}`);
      stored.add(`${lang}:${descriptionOf(p, lang)}`);
    },
  };
});

const { handleAdminAudio } = await import('./admin-audio');

const place = locations[0];
const get = (id: number | string) => handleAdminAudio(new Request(`https://x/api/admin?action=audio&id=${id}`), new URL(`https://x/api/admin?action=audio&id=${id}`));
const post = (body: unknown, ip = '1.1.1.1') =>
  handleAdminAudio(
    new Request('https://x/api/admin?action=audio', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': ip } }),
    new URL('https://x/api/admin?action=audio'),
  );

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
  stored.clear();
  generated = [];
  places = locations.map(l => ({ ...l }));
});

describe('admin audio', () => {
  it('reports each language’s status and the version of its saved text', async () => {
    stored.add(`en:${place.descriptionEn}`);
    const res = await get(place.id);
    expect(await res.json()).toEqual({
      en: { status: 'stored', version: textHash(place.descriptionEn) },
      ar: { status: 'missing', version: textHash(place.descriptionAr) },
      // No French description yet: French audio is narrated from the English text.
      fr: { status: 'missing', version: textHash(place.descriptionEn) },
      es: { status: 'missing', version: textHash(place.descriptionEn) },
    });
  });

  it('uses the French description for French audio once there is one', async () => {
    places[0].descriptionFr = 'Une description en français.';
    const body = await (await get(place.id)).json();
    expect(body.fr.version).toBe(textHash('Une description en français.'));
    expect((await post({ id: place.id, lang: 'fr', version: textHash('Une description en français.') })).status).toBe(200);
    expect(generated).toEqual([`${place.id}:fr`]);
  });

  it('says when there is no Blob store', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const body = await (await get(place.id)).json();
    expect(body.en.status).toBe('unavailable');
  });

  it('generates audio for the saved text', async () => {
    const res = await post({ id: place.id, lang: 'ar', version: textHash(place.descriptionAr) });
    expect(res.status).toBe(200);
    expect(generated).toEqual([`${place.id}:ar`]);
    expect((await (await get(place.id)).json()).ar.status).toBe('stored');
  });

  it('refuses when the admin’s text differs from the saved text', async () => {
    const res = await post({ id: place.id, lang: 'en', version: textHash('an unsaved edit') });
    expect(res.status).toBe(409);
    expect(generated).toEqual([]);
  });

  it('does not regenerate audio that is already stored', async () => {
    stored.add(`en:${place.descriptionEn}`);
    const res = await post({ id: place.id, lang: 'en', version: textHash(place.descriptionEn) });
    expect(res.status).toBe(200);
    expect(generated).toEqual([]);
  });

  it.each([
    [{ id: place.id, lang: 'de', version: 'x' }, 400],
    [{ id: 999999, lang: 'en', version: 'x' }, 404],
  ])('rejects %j', async (body, status) => {
    expect((await post(body)).status).toBe(status);
  });

  it('rejects places with no description in that language', async () => {
    places[0].descriptionAr = '';
    expect((await post({ id: place.id, lang: 'ar', version: textHash('') })).status).toBe(422);
  });

  it('rate-limits generation', async () => {
    let last = 0;
    for (let i = 0; i < 32; i++) {
      places[0].descriptionEn = `Text ${i}`;
      last = (await post({ id: place.id, lang: 'en', version: textHash(`Text ${i}`) }, '9.9.9.9')).status;
    }
    expect(last).toBe(429);
    expect(generated.length).toBe(30);
  });
});
