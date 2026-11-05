// Downloads a route for offline use, and remembers which routes are saved.
// Files go into the service worker's own caches (offline-caches.ts), so it
// serves them with no connection. The list of saved routes is kept in
// localStorage and shared by every component through useOfflineRoutes().

import { useSyncExternalStore } from 'react';
import { OFFLINE_CACHES } from './offline-caches';
import type { PackFile } from './offline-pack';

const STORAGE_KEY = 'cairo-walks:offline-routes';

export type SavedRoute = {
  /** The files that were saved. */
  files: PackFile[];
  /** URLs that couldn't be downloaded (for example, audio that failed). */
  failed: string[];
  bytes: number;
  savedAt: number;
};

export type SavedRoutes = Record<string, SavedRoute>;

/** Routes are saved per language: `<routeId>:<lang>`. */
export const savedRouteKey = (routeId: string, lang: string) => `${routeId}:${lang}`;

const isPackFile = (f: unknown): f is PackFile =>
  !!f && typeof (f as PackFile).url === 'string' && (f as PackFile).kind in OFFLINE_CACHES;

/** Reads the stored list, dropping anything malformed. */
export function parseSavedRoutes(raw: string | null): SavedRoutes {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: SavedRoutes = {};
    for (const [key, r] of Object.entries(value as Record<string, SavedRoute>)) {
      if (!r || !Array.isArray(r.files) || !Array.isArray(r.failed)) continue;
      out[key] = {
        files: r.files.filter(isPackFile),
        failed: r.failed.filter((u): u is string => typeof u === 'string'),
        bytes: Number.isFinite(r.bytes) ? r.bytes : 0,
        savedAt: Number.isFinite(r.savedAt) ? r.savedAt : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

const read = (): SavedRoutes => {
  try {
    return parseSavedRoutes(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
};

let saved: SavedRoutes | null = null;
const listeners = new Set<() => void>();
const current = () => (saved ??= read());

const update = (next: SavedRoutes) => {
  saved = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not saved; this tab still knows about it until it's closed.
  }
  listeners.forEach(l => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      saved = read();
      listener();
    }
  };
  globalThis.addEventListener?.('storage', onStorage);
  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.('storage', onStorage);
  };
};

/** The saved routes. Re-renders when they change. */
export const useOfflineRoutes = (): SavedRoutes => useSyncExternalStore(subscribe, current, current);

/** For tests: forget the in-memory copy so the next read comes from storage. */
export const resetOfflineRoutesForTest = () => {
  saved = null;
};

export const offlineSupported = () => typeof globalThis.caches !== 'undefined';

/**
 * What the saved copy is missing compared with what the route needs now:
 * files added since (an edited description gets a new audio URL, a new photo,
 * a moved place's tiles), and files the download couldn't fetch.
 */
export function missingFiles(savedRoute: SavedRoute | undefined, needed: PackFile[]): PackFile[] {
  if (!savedRoute) return needed;
  const have = new Set(savedRoute.files.map(f => f.url));
  return needed.filter(f => !have.has(f.url));
}

/** Checks the saved files are still in the caches (browsers can clear them). */
export async function filesStillCached(savedRoute: SavedRoute): Promise<boolean> {
  if (!offlineSupported()) return false;
  for (const kind of Object.keys(OFFLINE_CACHES) as (keyof typeof OFFLINE_CACHES)[]) {
    const urls = savedRoute.files.filter(f => f.kind === kind).map(f => f.url);
    if (urls.length === 0) continue;
    const cache = await caches.open(OFFLINE_CACHES[kind]);
    for (const url of urls) if (!(await cache.match(url))) return false;
  }
  return true;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

// Fetches one file and stores it. Returns its size, or null if it failed.
async function fetchInto(cache: Cache, file: PackFile, signal?: AbortSignal): Promise<number | null> {
  const cached = await cache.match(file.url);
  if (cached) return (await cached.blob()).size;
  // Map tiles come from another site: ask for a normal (CORS) response, so
  // its size is known and it doesn't count as a huge opaque entry.
  const init: RequestInit = file.kind === 'tiles' ? { mode: 'cors', credentials: 'omit', signal } : { signal };
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(file.url, init);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      return null;
    }
    if (res.status === 429 && attempt === 0) {
      // Rate-limited: wait as asked (at most 20 s), then try once more.
      const asked = Number(res.headers.get('Retry-After') ?? NaN);
      const seconds = Math.min(Number.isFinite(asked) && asked >= 0 ? asked : 5, 20);
      await wait(seconds * 1000, signal);
      continue;
    }
    if (!res.ok) return null;
    // A text-only fallback (no recording) isn't worth keeping offline.
    if (file.kind === 'audio' && !res.headers.get('Content-Type')?.startsWith('audio/')) return null;
    const body = await res.blob();
    await cache.put(file.url, new Response(body, { headers: res.headers }));
    return body.size;
  }
  return null;
}

export type Progress = { done: number; total: number };
type DownloadOptions = {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
  concurrency?: number;
  /** Check every file, not just new ones (for when the browser cleared some). */
  recheck?: boolean;
};

// Downloads files into their caches, a few at a time. Files already cached
// are kept, not re-fetched. Rejects with an AbortError if cancelled.
async function fetchFiles(needed: PackFile[], { onProgress, signal, concurrency = 3 }: DownloadOptions) {
  const caches_ = Object.fromEntries(
    await Promise.all(Object.entries(OFFLINE_CACHES).map(async ([kind, name]) => [kind, await caches.open(name)])),
  ) as Record<keyof typeof OFFLINE_CACHES, Cache>;
  const files: PackFile[] = [];
  const failed: string[] = [];
  let bytes = 0;
  let done = 0;
  let next = 0;
  onProgress?.({ done, total: needed.length });
  const worker = async () => {
    while (next < needed.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const file = needed[next++];
      const size = await fetchInto(caches_[file.kind], file, signal);
      if (size === null) failed.push(file.url);
      else {
        files.push(file);
        bytes += size;
      }
      onProgress?.({ done: ++done, total: needed.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, needed.length) }, worker));
  return { files, failed, bytes };
}

/**
 * Downloads a route, or updates a saved one: fetches only what it's missing,
 * keeps what it still needs, and forgets files it no longer uses (deleting
 * them unless another saved route uses them). Rejects with an AbortError if
 * cancelled; files fetched so far stay cached for next time.
 */
export async function saveRoute(key: string, needed: PackFile[], opts: DownloadOptions = {}): Promise<SavedRoute> {
  if (!offlineSupported()) throw new Error('Offline storage is not available in this browser');
  // Ask the browser not to clear these files when space runs low.
  navigator.storage?.persist?.().catch(() => {});

  const before = read()[key];
  const neededUrls = new Set(needed.map(f => f.url));
  const fresh = await fetchFiles(opts.recheck ? needed : missingFiles(before, needed), opts);
  const freshUrls = new Set(fresh.files.map(f => f.url));
  const kept = opts.recheck ? [] : (before?.files ?? []).filter(f => neededUrls.has(f.url) && !freshUrls.has(f.url));
  const dropped = (before?.files ?? []).filter(f => !neededUrls.has(f.url));
  // Sizes aren't stored per file, so estimate the share of what's kept.
  const keptBytes = before && before.files.length ? Math.round(before.bytes * (kept.length / before.files.length)) : 0;
  const order = new Map(needed.map((f, i) => [f.url, i]));
  const route: SavedRoute = {
    files: [...kept, ...fresh.files].sort((a, b) => order.get(a.url)! - order.get(b.url)!),
    failed: fresh.failed,
    bytes: keptBytes + fresh.bytes,
    savedAt: Date.now(),
  };
  const all = { ...read(), [key]: route };
  update(all);
  await deleteUnused(dropped, all);
  return route;
}

// Deletes files no saved route uses any more.
async function deleteUnused(files: PackFile[], all: SavedRoutes) {
  if (files.length === 0 || !offlineSupported()) return;
  const inUse = new Set(Object.values(all).flatMap(r => r.files.map(f => f.url)));
  for (const f of files) {
    if (inUse.has(f.url)) continue;
    try {
      await (await caches.open(OFFLINE_CACHES[f.kind])).delete(f.url);
    } catch {
      // Left in the cache; the service worker's expiry cleans it up later.
    }
  }
}

/** Removes a saved route, deleting its files unless another saved route uses them. */
export async function removeRoute(key: string) {
  const all = read();
  const route = all[key];
  if (!route) return;
  const rest = { ...all };
  delete rest[key];
  update(rest);
  await deleteUnused(route.files, rest);
}
