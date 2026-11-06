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
