// POST /api/admin?action=describe-photo {src, name?} → {texts: {photoAltEn, photoAltAr, photoAltFr, photoAltEs}}
//
// Gemini looks at a place's or route's photo and drafts a short description
// for screen readers in each language. Nothing is saved here: the dashboard
// puts the drafts in the editor for the admin to check and save.

import { PHOTO_SRC } from '../../src/data/content.js';
import { LANGS, LANGUAGES } from '../../src/i18n/lang.js';
import { getClient } from './gemini.js';
import { createRateLimiter } from './guard.js';
import { json, readJson } from './http.js';
import { readUploadedPhoto, sniffImageType } from './photos.js';

const MAX_ALT = 250;
const MAX_IMAGE = 3_000_000;

// One Gemini call each, admin-only already; capped so a stuck button can't run up the bill.
export const describeLimit = createRateLimiter(40, 10 * 60_000, 'Too many photo descriptions. Try again in a few minutes.');

/** The photo address and optional place name, or a problem to send back. */
export function parseDescribeRequest(body: unknown): { src: string; name: string } | { error: string } {
  const { src, name } = (body ?? {}) as { src?: unknown; name?: unknown };
  if (typeof src !== 'string' || !PHOTO_SRC.test(src)) return { error: "That isn't one of the app's photos." };
  return { src, name: typeof name === 'string' ? name.trim().slice(0, 120) : '' };
}

/** Gemini's reply as the editor's fields: a trimmed, length-limited string per language. */
export function pickDescriptions(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const lang of LANGS) {
    const value = (raw as Record<string, unknown>)[lang];
    if (typeof value === 'string' && value.trim()) out[`photoAlt${LANGUAGES[lang].suffix}`] = value.trim().replace(/\s+/g, ' ').slice(0, MAX_ALT);
  }
  return out;
}

export const describePrompt = (name: string) => `You write alt text for photos in Cairo Walks, a walking-tour app for historic Cairo, for visitors who use a screen reader.
Describe what this photo shows${name ? ` (it is of "${name}")` : ''}: the main subject and what stands out (architecture, materials, colours, people, light), in one sentence of at most 140 characters.
Don't start with "Photo of" or "Image of". Don't guess dates or history you can't see. Use the place's usual name in each language.
Reply with only a JSON object with these keys: "en" (English), "ar" (Arabic), "fr" (French), "es" (Spanish).`;

/** The image to send: an upload from Blob, or the 480px copy of a built-in photo from the site. */
async function loadImage(src: string, origin: string): Promise<Uint8Array | null> {
  const upload = /^\/api\/photo\?id=([0-9a-f]{64})$/.exec(src);
  if (upload) return readUploadedPhoto(upload[1]);
  const res = await fetch(new URL(src.replace(/\.webp$/, '-480.webp'), origin)).catch(() => null);
  const fallback = res?.ok ? res : await fetch(new URL(src, origin)).catch(() => null);
  if (!fallback?.ok) return null;
  return new Uint8Array(await fallback.arrayBuffer());
}

export async function handleDescribePhoto(request: Request): Promise<Response> {
  const body = await readJson(request, 2_000);
  if (body instanceof Response) return body;
  const parsed = parseDescribeRequest(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const limited = describeLimit(request);
  if (limited) return limited;
  const bytes = await loadImage(parsed.src, new URL(request.url).origin);
  const type = bytes && bytes.length <= MAX_IMAGE ? sniffImageType(bytes) : null;
  if (!bytes || !type) return json({ error: "The photo couldn't be loaded." }, 404);
  const response = await getClient().models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: type, data: Buffer.from(bytes).toString('base64') } }, { text: describePrompt(parsed.name) }] }],
    config: { responseMimeType: 'application/json' },
  });
  let raw: unknown;
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    return json({ error: 'The description came back in an unexpected form. Try again.' }, 502);
  }
  const texts = pickDescriptions(raw);
  if (Object.keys(texts).length === 0) return json({ error: 'No description came back. Try again.' }, 502);
  return json({ texts });
}
