// POST /api/admin?action=summarize {name, descriptions: {en, ar, fr?, es?}} → {texts: {summaryEn, summaryAr, summaryFr, summaryEs}}
//
// Gemini reads a place's descriptions and drafts its "In short" line in each
// language. Nothing is saved here: the dashboard puts the drafts in the
// editor for the admin to check and save.

import { LANGS, LANGUAGES } from '../../src/i18n/lang.js';
import { getClient } from './gemini.js';
import { createRateLimiter } from './guard.js';
import { json, readJson } from './http.js';

export const MAX_SUMMARY = 160;
const MAX_DESCRIPTION = 2000;

// One Gemini call each, admin-only already; capped so a stuck button can't run up the bill.
export const summarizeLimit = createRateLimiter(40, 10 * 60_000, 'Too many summaries. Try again in a few minutes.');

/** The place name and its descriptions (English needed), or a problem to send back. */
export function parseSummarizeRequest(body: unknown): { name: string; descriptions: Partial<Record<string, string>> } | { error: string } {
  const { name, descriptions } = (body ?? {}) as { name?: unknown; descriptions?: unknown };
  const out: Partial<Record<string, string>> = {};
  if (descriptions && typeof descriptions === 'object') {
    for (const lang of LANGS) {
      const v = (descriptions as Record<string, unknown>)[lang];
      if (typeof v === 'string' && v.trim()) out[lang] = v.trim().slice(0, MAX_DESCRIPTION);
    }
  }
  if (!out.en) return { error: 'Write the English description first.' };
  return { name: typeof name === 'string' ? name.trim().slice(0, 120) : '', descriptions: out };
}

/** Gemini's reply as the editor's fields: a trimmed, one-line, length-limited string per language. */
export function pickSummaries(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const lang of LANGS) {
    const value = (raw as Record<string, unknown>)[lang];
    if (typeof value === 'string' && value.trim()) out[`summary${LANGUAGES[lang].suffix}`] = value.trim().replace(/\s+/g, ' ').slice(0, MAX_SUMMARY);
  }
  return out;
}

export const summarizePrompt = (name: string, descriptions: Partial<Record<string, string>>) => `You write the "In short" line for places in Cairo Walks, a walking-tour app for historic Cairo: one sentence a visitor reads first, standing in the street, before the full description.
Say what the place is and why it's worth a look, using only facts in the descriptions below${name ? ` of "${name}"` : ''}. At most 140 characters. No marketing words ("must-see", "breathtaking"), no "This is".
Write it in English, Arabic (Modern Standard Arabic), French and Spanish, each written naturally in that language (use the place's usual name in each).
Reply with only a JSON object with these keys: "en", "ar", "fr", "es".

${Object.entries(descriptions).map(([lang, text]) => `Description (${LANGUAGES[lang as keyof typeof LANGUAGES].english}):\n${text}`).join('\n\n')}`;

export async function handleSummarize(request: Request): Promise<Response> {
  const body = await readJson(request, 12_000);
  if (body instanceof Response) return body;
  const parsed = parseSummarizeRequest(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const limited = summarizeLimit(request);
  if (limited) return limited;
  const response = await getClient().models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: [{ role: 'user', parts: [{ text: summarizePrompt(parsed.name, parsed.descriptions) }] }],
    config: { responseMimeType: 'application/json' },
  });
  let raw: unknown;
  try {
    raw = JSON.parse(response.text ?? '');
  } catch {
    return json({ error: 'The summary came back in an unexpected form. Try again.' }, 502);
  }
  const texts = pickSummaries(raw);
  if (Object.keys(texts).length === 0) return json({ error: 'No summary came back. Try again.' }, 502);
  return json({ texts });
}
