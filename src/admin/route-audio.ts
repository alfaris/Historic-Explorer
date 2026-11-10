// "Generate missing audio" for a whole route: the counts per language and the
// one-after-another run, kept free of React so they're easy to test.

import type { Lang } from '../i18n/lang';
import type { AudioState } from './api';

export type PlaceAudio = { id: number; name: string; states: Record<Lang, AudioState> };

/** How many of the route's places have audio ready in `lang`, out of those that can have it (a description and a Blob store). */
export function audioCount(places: PlaceAudio[], lang: Lang): { ready: number; total: number; missing: PlaceAudio[] } {
  const eligible = places.filter(p => p.states[lang].status === 'stored' || p.states[lang].status === 'missing');
  const missing = eligible.filter(p => p.states[lang].status === 'missing' && p.states[lang].version);
  return { ready: eligible.length - missing.length, total: eligible.length, missing };
}

export type RunResult =
  /** Every missing one was generated. */
  | { kind: 'done'; generated: number }
  /** Stopped by Cancel. */
  | { kind: 'cancelled'; generated: number }
  /** The server's limit (30 per 10 minutes) was reached. */
  | { kind: 'limited'; generated: number }
  /** Something else went wrong on one place; the run stops there. */
  | { kind: 'failed'; generated: number; place: string; message: string };

/**
 * Generates `lang` audio for each place in turn. `generate` throws an error
 * with `status` 429 at the server's limit. Stops at the first failure, since a
 * second one would most likely fail the same way.
 */
export async function generateMissing(
  missing: PlaceAudio[],
  lang: Lang,
  generate: (placeId: number, lang: Lang, version: string) => Promise<unknown>,
  { cancelled, onGenerated }: { cancelled: () => boolean; onGenerated: (placeId: number) => void },
): Promise<RunResult> {
  let generated = 0;
  for (const place of missing) {
    if (cancelled()) return { kind: 'cancelled', generated };
    try {
      await generate(place.id, lang, place.states[lang].version!);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429) return { kind: 'limited', generated };
      return { kind: 'failed', generated, place: place.name, message: e.message };
    }
    generated++;
    onGenerated(place.id);
  }
  return { kind: 'done', generated };
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the order of the results. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** How long a run across every route waits at the server's limit before trying again. */
export const LIMIT_PAUSE_MS = 60_000;

export type AllRunResult = { generated: number; cancelled: boolean; failures: { place: string; message: string }[] };

/**
 * "Generate all missing" across every route: like generateMissing, but a
 * failure on one place is noted and the run carries on with the rest, and at
 * the server's limit it waits (onPaused) and tries the same place again,
 * instead of stopping. Cancel stops it, including during a wait.
 */
export async function generateAllMissing(
  missing: PlaceAudio[],
  lang: Lang,
  generate: (placeId: number, lang: Lang, version: string) => Promise<unknown>,
  {
    cancelled,
    onGenerated,
    onPaused = () => {},
    wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    pauseMs = LIMIT_PAUSE_MS,
  }: {
    cancelled: () => boolean;
    onGenerated: (placeId: number) => void;
    onPaused?: (paused: boolean) => void;
    wait?: (ms: number) => Promise<void>;
    pauseMs?: number;
  },
): Promise<AllRunResult> {
  let generated = 0;
  const failures: AllRunResult['failures'] = [];
  for (const place of missing) {
    for (;;) {
      if (cancelled()) return { generated, cancelled: true, failures };
      try {
        await generate(place.id, lang, place.states[lang].version!);
        generated++;
        onGenerated(place.id);
        break;
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status !== 429) {
          failures.push({ place: place.name, message: e.message });
          break;
        }
        // At the limit: wait a minute (in steps, so Cancel is quick) and try this place again.
        onPaused(true);
        for (let waited = 0; waited < pauseMs && !cancelled(); waited += 1000) await wait(Math.min(1000, pauseMs - waited));
        onPaused(false);
      }
    }
  }
  return { generated, cancelled: false, failures };
}
