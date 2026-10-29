import { createHash } from 'node:crypto';
import { GoogleGenAI, Modality, ThinkingLevel } from '@google/genai';
import { get, put } from '@vercel/blob';
import { locations } from '../../src/data/locations.js';

// Server-only: the key is read at request time and never shipped to the browser.
let client: GoogleGenAI | null = null;
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server');
  client ??= new GoogleGenAI({ apiKey });
  return client;
};

type Lang = 'en' | 'ar';

const parseParams = (url: URL) => {
  const id = Number(url.searchParams.get('id'));
  const lang: Lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const location = locations.find(l => l.id === id);
  return { location, lang };
};

const json = (body: unknown, status = 200, cacheControl = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });

// Audio for a location never changes, so let the CDN keep it.
const AUDIO_CACHE = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400';
const LIVE_INFO_CACHE = 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400';

// Warm instances reuse these, so repeat requests skip Gemini entirely.
const audioCache = new Map<string, Promise<Uint8Array>>();

// Bump when the narration prompt, models or voices change, so stored audio is regenerated.
const AUDIO_VERSION = 'v1';

// Generated audio is kept in Vercel Blob so it survives deploys (the CDN cache does not).
// Without a connected store (e.g. local dev) audio is generated on every cold request.
const hasBlobStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Keyed by content, so editing a description in locations.ts produces fresh audio.
const audioBlobPath = (text: string, lang: Lang) =>
  `audio-guide/${createHash('sha256').update(`${AUDIO_VERSION}|${lang}|${text}`).digest('hex').slice(0, 32)}.wav`;

const readStoredAudio = async (pathname: string) => {
  if (!hasBlobStore()) return null;
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result?.stream) return null;
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  } catch (err) {
    console.warn('Reading stored audio failed:', err);
    return null;
  }
};

const storeAudio = async (pathname: string, wav: Uint8Array) => {
  if (!hasBlobStore()) return;
  try {
    await put(pathname, Buffer.from(wav), {
      access: 'private',
      contentType: 'audio/wav',
      allowOverwrite: true,
    });
  } catch (err) {
    console.warn('Storing audio failed:', err);
  }
};

const loadOrGenerateAudio = async (text: string, lang: Lang, pathname: string) => {
  const stored = await readStoredAudio(pathname);
  if (stored) return stored;
  const wav = await generateAudio(text, lang);
  await storeAudio(pathname, wav);
  return wav;
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

export async function handleAudioGuide(url: URL): Promise<Response> {
  const { location, lang } = parseParams(url);
  const text = lang === 'ar' ? location?.descriptionAr : location?.descriptionEn;
  if (!location || !text) return json({ error: 'Unknown location' }, 404);

  const key = audioBlobPath(text, lang);
  let pending = audioCache.get(key);
  if (!pending) {
    pending = loadOrGenerateAudio(text, lang, key);
    audioCache.set(key, pending);
    pending.catch(() => audioCache.delete(key));
  }

  try {
    const wav = await pending;
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

export async function handleLiveInfo(url: URL): Promise<Response> {
  const { location, lang } = parseParams(url);
  if (!location) return json({ error: 'Unknown location' }, 404);

  const prompt = lang === 'ar'
    ? `أعطني معلومات سياحية حية ومراجعات وتفاصيل تاريخية محدثة عن "${location.nameAr}" في القاهرة، مصر. استخدم بحث جوجل للحصول على أحدث المصادر.`
    : `Provide live tourist information, reviews, and updated historical details about "${location.nameEn}" in Cairo, Egypt. Use Google Search to find the latest sources.`;

  try {
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

    return json({ text: response.text ?? null, links: [...links.values()] }, 200, LIVE_INFO_CACHE);
  } catch (err) {
    console.error('Live info failed:', err);
    return json({ error: 'Live info request failed' }, 502);
  }
}
