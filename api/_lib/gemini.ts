import { createHash } from 'node:crypto';
import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import { BlobNotFoundError, get, head, put } from '@vercel/blob';
import { locations, type Location } from '../../src/data/locations.js';
import { parseCanonicalQuery, rateLimit } from './guard.js';

// Server-only: the key is read at request time and never shipped to the browser.
let client: GoogleGenAI | null = null;
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server');
  client ??= new GoogleGenAI({ apiKey });
  return client;
};

export type Lang = 'en' | 'ar';

// Runs the rate limit and query checks shared by both endpoints. Returns the
// place and language, or an error response to send back as is.
const checkRequest = (request: Request): { location: Location; lang: Lang } | Response => {
  const limited = rateLimit(request);
  if (limited) return limited;
  const query = parseCanonicalQuery(new URL(request.url));
  if (query instanceof Response) return query;
  const location = locations.find(l => l.id === query.id);
  if (!location) return json({ error: 'Unknown location' }, 404);
  return { location, lang: query.lang };
};

const json = (body: unknown, status = 200, cacheControl = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });

// Audio for a location never changes, so let the CDN keep it.
const AUDIO_CACHE = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400';
const LIVE_INFO_CACHE = 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400';

// After a failed generation, callers get the same failure for this long instead
// of triggering another Gemini call straight away.
const FAILURE_COOLDOWN_MS = 60_000;

type CacheEntry<T> = { promise: Promise<T>; expiresAt: number };

// In-memory cache shared by concurrent and repeat requests on a warm instance.
// Concurrent callers share one in-flight call; failures are kept for the cooldown.
const memoize = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  load: () => Promise<T>,
  expiresAt: (value: T) => number,
): Promise<T> => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  const entry: CacheEntry<T> = { promise: load(), expiresAt: Infinity };
  cache.set(key, entry);
  entry.promise.then(
    value => { entry.expiresAt = expiresAt(value); },
    () => { entry.expiresAt = Date.now() + FAILURE_COOLDOWN_MS; },
  );
  return entry.promise;
};

const audioCache = new Map<string, CacheEntry<Uint8Array>>();

// Bump when the narration prompt, models or voices change, so stored audio is regenerated.
const AUDIO_VERSION = 'v1';

// Generated audio is kept in Vercel Blob so it survives deploys (the CDN cache does not).
// Without a connected store (e.g. local dev) audio is generated on every cold request.
const hasBlobStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Keyed by content, so editing a description in locations.ts produces fresh audio.
const audioBlobPath = (text: string, lang: Lang) =>
  `audio-guide/${createHash('sha256').update(`${AUDIO_VERSION}|${lang}|${text}`).digest('hex').slice(0, 32)}.wav`;

const readStoredBlob = async (pathname: string, useCache = true) => {
  if (!hasBlobStore()) return null;
  try {
    const result = await get(pathname, { access: 'private', useCache });
    if (!result?.stream) return null;
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  } catch (err) {
    console.warn(`Reading ${pathname} from Blob failed:`, err);
    return null;
  }
};

// Returns whether the blob was stored. Failures are logged, not thrown, so a
// request can still be answered when Blob is unavailable.
const storeBlob = async (pathname: string, body: Uint8Array | string, contentType: string) => {
  if (!hasBlobStore()) return false;
  try {
    await put(pathname, typeof body === 'string' ? body : Buffer.from(body), {
      access: 'private',
      contentType,
      allowOverwrite: true,
    });
    return true;
  } catch (err) {
    console.warn(`Storing ${pathname} in Blob failed:`, err);
    return false;
  }
};

const loadOrGenerateAudio = async (text: string, lang: Lang, pathname: string) => {
  const stored = await readStoredBlob(pathname);
  if (stored) return stored;
  const wav = await generateAudio(text, lang);
  await storeBlob(pathname, wav, 'audio/wav');
  return wav;
};

// The exact text the audio is generated from and keyed by. The request handler
// and the pre-generation script must both use this, or their keys won't match.
const audioText = (location: Location, lang: Lang) =>
  (lang === 'ar' ? location.descriptionAr : location.descriptionEn) || null;

/** Whether this place's audio is already in Blob for the current description and AUDIO_VERSION. */
export async function audioStatus(location: Location, lang: Lang): Promise<'stored' | 'missing' | 'no-text'> {
  if (!hasBlobStore()) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const text = audioText(location, lang);
  if (!text) return 'no-text';
  try {
    await head(audioBlobPath(text, lang));
    return 'stored';
  } catch (err) {
    if (err instanceof BlobNotFoundError) return 'missing';
    throw err;
  }
}

/** Generates this place's audio and stores it in Blob. Throws if either step fails. */
export async function generateAndStoreAudio(location: Location, lang: Lang): Promise<void> {
  const text = audioText(location, lang);
  if (!text) throw new Error('Place has no description in this language');
  let wav: Uint8Array;
  try {
    wav = await generateAudio(text, lang);
  } catch (err) {
    if (err instanceof ScriptOnlyError) throw new Error('Text-to-speech failed (the app would fall back to the browser voice)');
    throw err;
  }
  if (!(await storeBlob(audioBlobPath(text, lang), wav, 'audio/wav'))) throw new Error('Storing the audio in Blob failed');
}

// Live info is regenerated at most once a day per place and language, however
// many people ask for it. Bump the version when the prompt or model changes.
const LIVE_INFO_VERSION = 'v1';
const LIVE_INFO_TTL_MS = 24 * 60 * 60 * 1000;

type LiveInfo = { text: string | null; links: { uri: string; title?: string }[]; generatedAt: number };

const liveInfoCache = new Map<string, CacheEntry<LiveInfo>>();

const liveInfoBlobPath = (location: Location, lang: Lang) =>
  `live-info/${createHash('sha256')
    .update(`${LIVE_INFO_VERSION}|${lang}|${location.id}|${location.nameEn}|${location.nameAr}`)
    .digest('hex')
    .slice(0, 32)}.json`;

const loadOrGenerateLiveInfo = async (location: Location, lang: Lang, pathname: string) => {
  // Skip Blob's CDN cache, which could hand back an older copy that looks expired
  // and cause a fresh Gemini call on every request.
  const stored = await readStoredBlob(pathname, false);
  if (stored) {
    try {
      const info: LiveInfo = JSON.parse(new TextDecoder().decode(stored));
      if (Date.now() - info.generatedAt < LIVE_INFO_TTL_MS) return info;
    } catch (err) {
      console.warn('Stored live info is unreadable, regenerating:', err);
    }
  }
  const info = await generateLiveInfo(location, lang);
  await storeBlob(pathname, JSON.stringify(info), 'application/json');
  return info;
};

const pcmToWav = (pcm: Uint8Array, sampleRate = 24000) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
};

class ScriptOnlyError extends Error {
  constructor(public script: string) {
    super('TTS unavailable');
  }
}

const generateAudio = async (text: string, lang: Lang) => {
  const ai = getClient();

  // A lite model with minimal thinking and a short script keeps both steps fast.
  const scriptResponse = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: `You are an immersive audio guide narrator for the historical city of Cairo. Make this historical fact sound like a captivating, slightly dramatic story for a tourist standing right there. Do NOT include any formatting, markdown, or sound effect markers. Keep it to about 90 words. Speak directly to the listener as if you are standing next to them. The response MUST be ONLY the spoken text, in ${lang === 'ar' ? 'Arabic' : 'English'}. Here is the information:\n${text}`,
    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
  });
  const script = scriptResponse.text?.trim();
  if (!script) throw new Error('Failed to generate script');

  try {
    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'ar' ? 'Zephyr' : 'Kore' } },
        },
      },
    });
    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio returned');
    return pcmToWav(new Uint8Array(Buffer.from(base64Audio, 'base64')));
  } catch (err) {
    console.warn('Gemini TTS failed, returning script only:', err);
    throw new ScriptOnlyError(script);
  }
};

export async function handleAudioGuide(request: Request): Promise<Response> {
  const checked = checkRequest(request);
  if (checked instanceof Response) return checked;
  const { location, lang } = checked;
  const text = audioText(location, lang);
  if (!text) return json({ error: 'Unknown location' }, 404);

  const key = audioBlobPath(text, lang);
  try {
    const wav = await memoize(audioCache, key, () => loadOrGenerateAudio(text, lang, key), () => Infinity);
    return new Response(wav, {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': AUDIO_CACHE },
    });
  } catch (err) {
    // The client reads the script aloud with the browser voice instead.
    if (err instanceof ScriptOnlyError) return json({ script: err.script });
    console.error('Audio guide failed:', err);
    return json({ error: 'Audio generation failed' }, 502);
  }
}

const generateLiveInfo = async (location: Location, lang: Lang): Promise<LiveInfo> => {
  const prompt = lang === 'ar'
    ? `أعطني معلومات سياحية حية ومراجعات وتفاصيل تاريخية محدثة عن "${location.nameAr}" في القاهرة، مصر. استخدم بحث جوجل للحصول على أحدث المصادر.`
    : `Provide live tourist information, reviews, and updated historical details about "${location.nameEn}" in Cairo, Egypt. Use Google Search to find the latest sources.`;

  const response = await getClient().models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const links = new Map<string, { uri: string; title?: string }>();
  for (const chunk of response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    if (chunk.web?.uri) links.set(chunk.web.uri, { uri: chunk.web.uri, title: chunk.web.title });
    if (chunk.maps?.uri) links.set(chunk.maps.uri, { uri: chunk.maps.uri, title: chunk.maps.title });
  }

  return { text: response.text ?? null, links: [...links.values()], generatedAt: Date.now() };
};

export async function handleLiveInfo(request: Request): Promise<Response> {
  const checked = checkRequest(request);
  if (checked instanceof Response) return checked;
  const { location, lang } = checked;

  const key = liveInfoBlobPath(location, lang);
  try {
    const info = await memoize(
      liveInfoCache,
      key,
      () => loadOrGenerateLiveInfo(location, lang, key),
      value => value.generatedAt + LIVE_INFO_TTL_MS,
    );
    return json({ text: info.text, links: info.links }, 200, LIVE_INFO_CACHE);
  } catch (err) {
    console.error('Live info failed:', err);
    return json({ error: 'Live info request failed' }, 502);
  }
}
