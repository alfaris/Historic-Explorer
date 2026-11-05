import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackFile } from './offline-pack';
import {
  filesStillCached,
  missingFiles,
  parseSavedRoutes,
  removeRoute,
  resetOfflineRoutesForTest,
  saveRoute,
} from './offline-store';

// In-memory stand-ins for Cache Storage, localStorage and the network.
class FakeCache {
  entries = new Map<string, Response>();
  async match(url: string) {
    return this.entries.get(url)?.clone();
  }
  async put(url: string, res: Response) {
    this.entries.set(url, res);
  }
  async delete(url: string) {
    return this.entries.delete(url);
  }
}
let stores: Map<string, FakeCache>;
let storage: Map<string, string>;
let responses: Record<string, () => Response>;
let fetched: string[];

beforeEach(() => {
  stores = new Map();
  storage = new Map();
  fetched = [];
  responses = {};
  vi.stubGlobal('caches', {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name)!;
    },
  });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  vi.stubGlobal('fetch', async (url: string) => {
    // The live content is fetched on every save; tracked apart from route files.
    if (url !== '/api/content') fetched.push(url);
    const make = responses[url];
    return make ? make() : new Response('nope', { status: 404 });
  });
  resetOfflineRoutesForTest();
});
afterEach(() => vi.unstubAllGlobals());

const audio = (bytes = 10) => () => new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/wav' } });
const image = (bytes = 5) => () => new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/png' } });

const files: PackFile[] = [
  { url: '/api/audio-guide?id=1&lang=en&v=aaaaaaaa', kind: 'audio' },
  { url: '/images/photos/1.webp', kind: 'photos' },
  { url: 'https://a.tile.openstreetmap.org/16/1/2.png', kind: 'tiles' },
];

describe('saveRoute', () => {
  it('downloads every file into the right cache and saves the route', async () => {
    responses = { [files[0].url]: audio(10), [files[1].url]: image(5), [files[2].url]: image(7) };
    const progress: number[] = [];
    const saved = await saveRoute('r:en', files, { onProgress: p => progress.push(p.done) });
    expect(saved.files).toEqual(files);
    expect(saved.failed).toEqual([]);
    expect(saved.bytes).toBe(22);
    expect(progress.at(-1)).toBe(3);
    expect(stores.get('audio-guides')!.entries.has(files[0].url)).toBe(true);
    expect(stores.get('place-photos')!.entries.has(files[1].url)).toBe(true);
    expect(stores.get('leaflet-tiles')!.entries.has(files[2].url)).toBe(true);
    expect(parseSavedRoutes(storage.get('cairo-walks:offline-routes')!)['r:en'].files).toHaveLength(3);
    expect(await filesStillCached(saved)).toBe(true);
  });

  it('records failures, and does not keep a text-only audio fallback', async () => {
    responses = {
      [files[0].url]: () => new Response('{"script":"hi"}', { headers: { 'Content-Type': 'application/json' } }),
      [files[1].url]: image(),
    };
    const saved = await saveRoute('r:en', files);
    expect(saved.files.map(f => f.url)).toEqual([files[1].url]);
    expect(saved.failed.sort()).toEqual([files[0].url, files[2].url].sort());
    expect(stores.get('audio-guides')!.entries.size).toBe(0);
    expect(missingFiles(saved, files).map(f => f.url).sort()).toEqual(saved.failed.sort());
  });

  it('on update, fetches only new files and drops ones no longer needed', async () => {
    responses = { [files[0].url]: audio(), [files[1].url]: image(), [files[2].url]: image() };
    await saveRoute('r:en', files);
    fetched = [];
    const editedAudio: PackFile = { url: '/api/audio-guide?id=1&lang=en&v=bbbbbbbb', kind: 'audio' };
    responses[editedAudio.url] = audio();
    const updated = await saveRoute('r:en', [editedAudio, files[1], files[2]]);
    expect(fetched).toEqual([editedAudio.url]);
    expect(updated.files.map(f => f.url)).toEqual([editedAudio.url, files[1].url, files[2].url]);
    expect(stores.get('audio-guides')!.entries.has(files[0].url)).toBe(false);
  });

  it('re-fetches files the browser cleared when asked to recheck', async () => {
    responses = { [files[0].url]: audio(), [files[1].url]: image(), [files[2].url]: image() };
    const saved = await saveRoute('r:en', files);
    stores.get('place-photos')!.entries.clear();
    expect(await filesStillCached(saved)).toBe(false);
    fetched = [];
    await saveRoute('r:en', files, { recheck: true });
    expect(fetched).toEqual([files[1].url]);
    expect(await filesStillCached(saved)).toBe(true);
  });

  it('retries once after a rate limit', async () => {
    let calls = 0;
    responses = {
      [files[0].url]: () => (++calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '0' } }) : audio()()),
    };
    const saved = await saveRoute('r:en', [files[0]]);
    expect(calls).toBe(2);
    expect(saved.failed).toEqual([]);
  });

  it('stops when cancelled', async () => {
    responses = { [files[0].url]: audio(), [files[1].url]: image(), [files[2].url]: image() };
    const controller = new AbortController();
    controller.abort();
    await expect(saveRoute('r:en', files, { signal: controller.signal })).rejects.toThrow(/Abort/);
    expect(storage.has('cairo-walks:offline-routes')).toBe(false);
  });
});

describe('saveRoute: live content and failures', () => {
  it('saves the live routes and places with the download', async () => {
    responses = { '/api/content': () => new Response('{"routes":[],"places":[]}'), [files[0].url]: audio() };
    await saveRoute('r:en', [files[0]]);
    const cached = await stores.get('content')!.match('/api/content');
    expect(await cached!.text()).toBe('{"routes":[],"places":[]}');
  });

  it('keeps the existing content copy when the content request fails', async () => {
    stores.set('content', new FakeCache());
    await stores.get('content')!.put('/api/content', new Response('old'));
    responses = { [files[0].url]: audio() };
    await saveRoute('r:en', [files[0]]);
    expect(await (await stores.get('content')!.match('/api/content'))!.text()).toBe('old');
  });

  it('when a cache write fails, stops and reports it only after every request has finished', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const many: PackFile[] = Array.from({ length: 6 }, (_, i) => ({ url: `https://a.tile.openstreetmap.org/16/1/${i}.png`, kind: 'tiles' }));
    for (const f of many) responses[f.url] = image();
    // The first tile's write fails (out of space); the second is slow.
    const realOpen = (globalThis as any).caches.open;
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        const cache = await realOpen(name);
        if (name !== 'leaflet-tiles') return cache;
        return {
          match: (u: string) => cache.match(u),
          delete: (u: string) => cache.delete(u),
          put: async (u: string, r: Response) => {
            if (u === many[0].url) throw new DOMException('Quota exceeded', 'QuotaExceededError');
            if (u === many[1].url) await gate;
            return cache.put(u, r);
          },
        };
      },
    });
    const progress: number[] = [];
    let settled = false;
    const run = saveRoute('r:en', many, { onProgress: p => progress.push(p.done), concurrency: 3 }).finally(() => (settled = true));
    await new Promise(r => setTimeout(r, 20));
    expect(settled).toBe(false); // still waiting for the slow request
    release();
    await expect(run).rejects.toThrow(/Quota/);
    const calls = progress.length;
    await new Promise(r => setTimeout(r, 20));
    expect(progress.length).toBe(calls); // nothing reported after the error
    expect(fetched.length).toBeLessThan(many.length); // stopped taking new files
  });
});

describe('removeRoute', () => {
  it('deletes files only when no other saved route uses them', async () => {
    responses = { [files[0].url]: audio(), [files[1].url]: image(), [files[2].url]: image() };
    const arabic: PackFile = { url: '/api/audio-guide?id=1&lang=ar&v=cccccccc', kind: 'audio' };
    responses[arabic.url] = audio();
    await saveRoute('r:en', files);
    await saveRoute('r:ar', [arabic, files[1], files[2]]);
    await removeRoute('r:en');
    expect(stores.get('audio-guides')!.entries.has(files[0].url)).toBe(false);
    expect(stores.get('place-photos')!.entries.has(files[1].url)).toBe(true);
    expect(stores.get('leaflet-tiles')!.entries.has(files[2].url)).toBe(true);
    expect(Object.keys(parseSavedRoutes(storage.get('cairo-walks:offline-routes')!))).toEqual(['r:ar']);
  });
});

describe('parseSavedRoutes', () => {
  it.each([null, '', 'x', '[]', '42'])('treats %j as nothing saved', raw => {
    expect(parseSavedRoutes(raw)).toEqual({});
  });

  it('drops malformed entries and files', () => {
    const raw = JSON.stringify({
      ok: { files: [{ url: '/a', kind: 'audio' }, { url: 1, kind: 'audio' }, { url: '/b', kind: 'nope' }], failed: ['/c', 2], bytes: 3, savedAt: 4 },
      bad: { files: 'x' },
    });
    expect(parseSavedRoutes(raw)).toEqual({ ok: { files: [{ url: '/a', kind: 'audio' }], failed: ['/c'], bytes: 3, savedAt: 4 } });
  });
});
