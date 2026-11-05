// POST /api/admin?action=translate {texts: {key: English text}} → {texts: {key: French text}}
//
// Drafts French for the admin's "Fill in missing French" button. Nothing is
// saved here: the dashboard puts the drafts in the editor, and the admin
// reviews and saves them the normal way, so every change lands in History.

import { getClient } from './gemini.js';
import { json, readJson } from './http.js';

const MAX_KEYS = 60;
const MAX_TEXT = 2000;
const MAX_TOTAL = 30_000;
const KEY = /^[a-z0-9.:_-]{1,40}$/i;

/** The texts to translate, or a problem to send back. */
export function parseTranslateRequest(body: unknown): { texts: Record<string, string> } | { error: string } {
  const raw = (body as { texts?: unknown } | null)?.texts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Expected {texts: {key: text}}.' };
  const texts: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (!KEY.test(key) || typeof value !== 'string') return { error: `Invalid entry "${key.slice(0, 40)}".` };
    const text = value.trim();
    if (!text) continue;
    if (text.length > MAX_TEXT) return { error: `"${key}" is longer than ${MAX_TEXT} characters.` };
    texts[key] = text;
    total += text.length;
  }
  const count = Object.keys(texts).length;
  if (count === 0) return { error: 'Nothing to translate.' };
  if (count > MAX_KEYS || total > MAX_TOTAL) return { error: 'Too much text at once; translate fewer items.' };
  return { texts };
}

/** Keeps only the requested keys whose translation is a non-empty string, trimmed to the length limit. */
export function pickTranslations(requested: Record<string, string>, raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(requested)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, MAX_TEXT);
  }
  return out;
}

const PROMPT = `You translate content for Cairo Walks, a walking-tour app for historic Cairo, from English into French.
Translate each value of the JSON object below into natural, accurate French for visitors. Keep the keys unchanged.
Keep proper names in their usual French form (e.g. "Mosquée Al-Azhar", "Le Caire"); keep transliterated Arabic names otherwise.
Do not add or drop information. Reply with only the JSON object.`;

export async function handleTranslate(request: Request): Promise<Response> {
  const body = await readJson(request, 100_000);
  if (body instanceof Response) return body;
  const parsed = parseTranslateRequest(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const response = await getClient().models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: `${PROMPT}\n\n${JSON.stringify(parsed.texts)}`,
    config: { responseMimeType: 'application/json' },
  });
  let raw: unknown;
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    return json({ error: 'The translation came back in an unexpected form. Try again.' }, 502);
  }
  return json({ texts: pickTranslations(parsed.texts, raw) });
}
