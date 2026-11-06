// Route downloads in progress, shared by every part of the app (the route's
// own button and the Offline sheet), so they show the same progress and the
// same route is never downloaded twice at once. "Download all" saves the
// routes one after another and can be cancelled.

import { useSyncExternalStore } from 'react';
import { saveRoute, type Progress, type SavedRoute } from './offline-store';
import type { PackFile } from './offline-pack';

export type DownloadsState = {
  /** Routes downloading now, by saved-route key. */
  progress: Record<string, Progress>;
  /** The last download of a route failed (by key): the message to show. */
  errors: Record<string, string>;
  /** "Download all": which route of how many, while it runs. */
  all: { index: number; count: number } | null;
};

let state: DownloadsState = { progress: {}, errors: {}, all: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<DownloadsState>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
};

const jobs = new Map<string, { controller: AbortController; promise: Promise<SavedRoute | null> }>();
let allCancelled = false;

/** The message shown when nothing at all could be downloaded. */
export const NOTHING_SAVED = 'nothing-saved';

/**
 * Downloads (or updates) one route. If it's already downloading, returns
 * that download instead of starting another. Resolves to the saved route, or
 * null if it was cancelled or failed (the error is in the state).
 */
export function startDownload(key: string, needed: PackFile[], opts: { recheck?: boolean } = {}): Promise<SavedRoute | null> {
  const running = jobs.get(key);
  if (running) return running.promise;
  const controller = new AbortController();
  const { [key]: _old, ...errors } = state.errors;
  set({ errors, progress: { ...state.progress, [key]: { done: 0, total: needed.length } } });
  const promise = saveRoute(key, needed, {
    signal: controller.signal,
    recheck: opts.recheck,
    onProgress: p => set({ progress: { ...state.progress, [key]: p } }),
  })
    .then(result => {
      if (result.files.length === 0) set({ errors: { ...state.errors, [key]: NOTHING_SAVED } });
      return result;
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') set({ errors: { ...state.errors, [key]: err.message || NOTHING_SAVED } });
      return null;
    })
    .finally(() => {
      jobs.delete(key);
      const { [key]: _done, ...progress } = state.progress;
      set({ progress });
    });
  jobs.set(key, { controller, promise });
  return promise;
}

export const cancelDownload = (key: string) => jobs.get(key)?.controller.abort();

/**
 * Saves each route in turn (skipping none: up-to-date routes finish at once,
 * since saved files aren't fetched again). Stops early when cancelled.
 */
export async function downloadAll(items: { key: string; needed: PackFile[]; recheck?: boolean }[]): Promise<void> {
  if (state.all) return;
  allCancelled = false;
  try {
    for (let i = 0; i < items.length; i++) {
      if (allCancelled) break;
      set({ all: { index: i, count: items.length } });
      // recheck: the browser cleared some of this route's files; fetch them all again.
      await startDownload(items[i].key, items[i].needed, { recheck: items[i].recheck });
    }
  } finally {
    set({ all: null });
  }
}

/** Stops "Download all" and the route it's on. */
export function cancelAll() {
  allCancelled = true;
  for (const job of jobs.values()) job.controller.abort();
}

export const useDownloads = (): DownloadsState =>
  useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );

export const getDownloads = () => state;
