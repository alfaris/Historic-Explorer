// Audio guides in the admin: which places have stored audio for their current
// text, and generating it on demand, so the first visitor after an edit doesn't
// wait for Gemini.
//
//   GET  audio?id=<placeId>          → { en: AudioState, ar: AudioState }
//   POST audio {id, lang, version}   → { state: 'stored' }
//
// `version` is the hash of the text the admin is looking at. If the saved text
// is different (unsaved edits, or someone else saved since), nothing is
// generated, so audio is only ever made for the text visitors will hear.

import type { Location } from '../../src/data/locations.js';
import { textHash } from '../../src/lib/text-hash.js';
import { getContentWithEtag } from './content.js';
import { audioStatus, generateAndStoreAudio, type Lang } from './gemini.js';
import { createRateLimiter } from './guard.js';
import { hasBlobStore, json, readJson } from './http.js';

export type AudioState = { status: 'stored' | 'missing' | 'no-text' | 'unavailable'; version: string | null };

// Each generation is two Gemini calls. Admin-only already, but cap it anyway
// so a stuck button or script can't run up the bill.
export const audioGenerateLimit = createRateLimiter(30, 10 * 60_000, 'Too many audio generations. Try again in a few minutes.');

const textFor = (place: Location, lang: Lang) => (lang === 'ar' ? place.descriptionAr : place.descriptionEn) || '';

// Fresh from storage, not the short memory cache: right after a save, another
// server instance may still hold the old text.
const findPlace = async (id: number) => (await getContentWithEtag()).content.places.find(p => p.id === id);

async function stateFor(place: Location, lang: Lang): Promise<AudioState> {
  const text = textFor(place, lang);
  const version = text ? textHash(text) : null;
  if (!hasBlobStore()) return { status: 'unavailable', version };
  return { status: await audioStatus(place, lang), version };
}

export async function handleAdminAudio(request: Request, url: URL): Promise<Response> {
  if (request.method === 'GET') {
    const id = Number(url.searchParams.get('id'));
    const place = Number.isInteger(id) ? await findPlace(id) : undefined;
    if (!place) return json({ error: 'Place not found. Save it first.' }, 404);
    const [en, ar] = await Promise.all([stateFor(place, 'en'), stateFor(place, 'ar')]);
    return json({ en, ar });
  }

  if (request.method === 'POST') {
    const body = await readJson(request, 1_000);
    if (body instanceof Response) return body;
    const { id, lang, version } = (body ?? {}) as { id?: unknown; lang?: unknown; version?: unknown };
    if (lang !== 'en' && lang !== 'ar') return json({ error: 'lang must be en or ar.' }, 400);
    if (!hasBlobStore()) return json({ error: 'No Blob store is connected, so audio can’t be stored.' }, 503);
    const place = typeof id === 'number' ? await findPlace(id) : undefined;
    if (!place) return json({ error: 'Place not found. Save it first.' }, 404);
    const text = textFor(place, lang);
    if (!text) return json({ error: 'This place has no description in that language.' }, 422);
    if (version !== textHash(text)) return json({ error: 'The description has unsaved changes (or was changed by someone else). Save, then generate.' }, 409);
    // Already there: nothing to spend.
    if ((await audioStatus(place, lang)) === 'stored') return json({ state: 'stored' });
    const limited = audioGenerateLimit(request);
    if (limited) return limited;
    await generateAndStoreAudio(place, lang);
    return json({ state: 'stored' });
  }

  return json({ error: 'Unknown admin action.' }, 404);
}
