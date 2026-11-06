import { beforeEach, describe, expect, it, vi } from 'vitest';

// A controllable saveRoute: each call waits until the test resolves it, or rejects on abort.
const calls: { key: string; resolve: (v: unknown) => void; signal: AbortSignal; onProgress?: (p: unknown) => void }[] = [];
vi.mock('./offline-store', () => ({
  saveRoute: vi.fn((key: string, _needed: unknown, opts: { signal: AbortSignal; onProgress?: (p: unknown) => void }) =>
    new Promise((resolve, reject) => {
      calls.push({ key, resolve, signal: opts.signal, onProgress: opts.onProgress });
      opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  ),
}));

const { startDownload, cancelDownload, downloadAll, cancelAll, getDownloads, NOTHING_SAVED } = await import('./offline-downloads');
const file = { url: 'https://x/1', kind: 'photos' as const };
const saved = { files: [file], failed: [], bytes: 10, savedAt: 1 };
const tick = () => new Promise(r => setTimeout(r, 0));

describe('offline downloads', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('shares one download per route and tracks its progress', async () => {
    const a = startDownload('r:en', [file]);
    const b = startDownload('r:en', [file]);
    expect(calls).toHaveLength(1);
    expect(getDownloads().progress['r:en']).toEqual({ done: 0, total: 1 });
    calls[0].onProgress?.({ done: 1, total: 1 });
    expect(getDownloads().progress['r:en']).toEqual({ done: 1, total: 1 });
    calls[0].resolve(saved);
    expect(await a).toEqual(saved);
    expect(await b).toEqual(saved);
    expect(getDownloads().progress['r:en']).toBeUndefined();
  });

  it('records a download that saved nothing as an error, and clears it on retry', async () => {
    const p = startDownload('s:en', [file]);
    calls[0].resolve({ ...saved, files: [] });
    await p;
    expect(getDownloads().errors['s:en']).toBe(NOTHING_SAVED);
    startDownload('s:en', [file]);
    expect(getDownloads().errors['s:en']).toBeUndefined();
    cancelDownload('s:en');
    await tick();
  });

  it('cancels quietly', async () => {
    const p = startDownload('c:en', [file]);
    cancelDownload('c:en');
    expect(await p).toBeNull();
    expect(getDownloads().errors['c:en']).toBeUndefined();
  });

  it('downloads all routes in turn, and stops when cancelled', async () => {
    const run = downloadAll([{ key: 'a:en', needed: [file] }, { key: 'b:en', needed: [file] }, { key: 'c:en', needed: [file] }]);
    await tick();
    expect(getDownloads().all).toEqual({ index: 0, count: 3 });
    calls[0].resolve(saved);
    await tick();
    await tick();
    expect(calls.map(c => c.key)).toEqual(['a:en', 'b:en']);
    expect(getDownloads().all).toEqual({ index: 1, count: 3 });
    cancelAll();
    await run;
    expect(calls.map(c => c.key)).toEqual(['a:en', 'b:en']); // c never started
    expect(getDownloads().all).toBeNull();
  });
});
