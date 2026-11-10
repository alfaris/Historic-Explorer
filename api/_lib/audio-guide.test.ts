import { beforeEach, describe, expect, it, vi } from 'vitest';
import { locations } from '../../src/data/locations';
import { audioVersion } from '../../src/lib/text-hash';

// Stand-ins for Blob storage, the live content and Gemini.
const blobs = new Map<string, string | Buffer>();
let failWav = false;
let geminiCalls = 0;
const prompts: string[] = [];
const SCRIPT = 'Stand here, traveller: these walls have watched Cairo for a thousand years — «ألف عام».';

vi.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  return {
    BlobNotFoundError,
    head: async (path: string) => {
      if (!blobs.has(path)) throw new BlobNotFoundError(path);
      return {};
    },
    get: async (path: string) => {
      const body = blobs.get(path);
      return body === undefined ? null : { stream: new Response(body).body };
    },
    put: async (path: string, body: string | Buffer) => {
      if (failWav && path.endsWith('.wav')) throw new Error('Blob is down');
      blobs.set(path, body);
      return {};
    },
  };
});
vi.mock('./content.js', () => ({ getContent: async () => ({ routes: [], places: locations }) }));
vi.mock('@google/genai', () => ({
  Modality: { AUDIO: 'AUDIO' },
  ThinkingLevel: { MINIMAL: 'MINIMAL' },
  GoogleGenAI: class {
    models = {
      generateContent: async (req: { model: string; contents: unknown }) => {
        geminiCalls++;
        if (typeof req.contents === 'string') prompts.push(req.contents);
        if (req.model.includes('tts')) return { candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from([1, 2, 3, 4]).toString('base64') } }] } }] };
        return { text: SCRIPT };
      },
    };
  },
}));

const { audioStatus, generateAndStoreAudio, handleAudioGuide, TRANSCRIPT_HEADER } = await import('./gemini');

const place = locations[0];
const request = (ip: string) =>
  handleAudioGuide(
    new Request(`https://x/api/audio-guide?id=${place.id}&lang=en&v=${audioVersion(place.descriptionEn!)}`, { headers: { 'x-real-ip': ip } }),
  );
const wavPath = () => [...blobs.keys()].find(k => k.endsWith('.wav'))!;

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
  process.env.GEMINI_API_KEY = 'test';
  blobs.clear();
  geminiCalls = 0;
  prompts.length = 0;
  failWav = false;
});

describe('narration brief', () => {
  it("tells each kind of place its own way, and stores it under a key that includes the brief", async () => {
    const mosque = locations.find(l => /Sultan Hassan/.test(l.nameEn))!;
    const tomb = locations.find(l => /Shajar al-Durr/.test(l.nameEn))!;
    await generateAndStoreAudio(mosque, 'en');
    await generateAndStoreAudio(tomb, 'ar');
    expect(prompts[0]).toMatch(/place of prayer/);
    expect(prompts[0]).toContain('Sultan Hassan Mosque');
    expect(prompts[1]).toMatch(/person buried here/);
    expect(prompts[1]).toContain(tomb.nameAr);
    for (const prompt of prompts) expect(prompt).toMatch(/Never begin with these.*"Imagine"/);
    // Same description, told as another kind of place: a different recording.
    expect(await audioStatus({ ...mosque, category: 'coffee' }, 'en')).toBe('missing');
    expect(await audioStatus(mosque, 'en')).toBe('stored');
  });
});

describe('audio guide transcripts', () => {
  it('stores the script next to the recording and sends it with the audio', async () => {
    const res = await request('1.0.0.1');
    expect(res.headers.get('Content-Type')).toBe('audio/wav');
    expect(decodeURIComponent(res.headers.get(TRANSCRIPT_HEADER)!)).toBe(SCRIPT);
    expect(res.headers.get('Cache-Control')).toMatch(/s-maxage=31536000/);
    expect(blobs.get(wavPath().replace(/\.wav$/, '.txt'))).toBe(SCRIPT);
    expect(await audioStatus(place, 'en')).toBe('stored');
  });

  it('serves older audio without a transcript, briefly cached, and counts it as missing until regenerated', async () => {
    // Audio saved before scripts were kept.
    await generateAndStoreAudio(place, 'en');
    blobs.delete(wavPath().replace(/\.wav$/, '.txt'));
    geminiCalls = 0;
    expect(await audioStatus(place, 'en')).toBe('missing');

    const old = await request('1.0.0.2');
    expect(old.headers.get('Content-Type')).toBe('audio/wav');
    expect(old.headers.get(TRANSCRIPT_HEADER)).toBeNull();
    expect(old.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=3600');
    expect(geminiCalls).toBe(0); // a visitor never pays for regeneration

    // The admin regenerates it: the script is stored and served right away.
    await generateAndStoreAudio(place, 'en');
    expect(await audioStatus(place, 'en')).toBe('stored');
    const fresh = await request('1.0.0.3');
    expect(decodeURIComponent(fresh.headers.get(TRANSCRIPT_HEADER)!)).toBe(SCRIPT);
  });

  it('never leaves a script beside a recording it does not match', async () => {
    // An old recording without a script, then a regeneration whose recording fails to save.
    await generateAndStoreAudio(place, 'en');
    const txt = wavPath().replace(/\.wav$/, '.txt');
    blobs.delete(txt);
    failWav = true;
    await expect(generateAndStoreAudio(place, 'en')).rejects.toThrow('Storing the audio in Blob failed');
    expect(blobs.has(txt)).toBe(false);
    expect(await audioStatus(place, 'en')).toBe('missing');
  });
});
