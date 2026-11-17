import { beforeEach, describe, expect, it } from 'vitest';
import { QUIZ_BEST_KEY, beats, mergeBests, parseBests } from './quiz-best';

describe('parseBests', () => {
  it('keeps only sensible scores', () => {
    const raw = JSON.stringify({ a: { score: 4, of: 5 }, b: { score: 6, of: 5 }, c: { score: -1, of: 3 }, d: { score: 1.5, of: 3 }, e: { score: 0, of: 0 }, f: 'x', g: { score: 2, of: 99 } });
    expect(parseBests(raw)).toEqual({ a: { score: 4, of: 5 } });
  });
  it('reads nothing from missing or broken data', () => {
    expect(parseBests(null)).toEqual({});
    expect(parseBests('{oops')).toEqual({});
    expect(parseBests('[1,2]')).toEqual({});
  });
});

describe('beats', () => {
  it('only a better score replaces the best', () => {
    expect(beats({ score: 3, of: 5 }, undefined)).toBe(true);
    expect(beats({ score: 4, of: 5 }, { score: 3, of: 5 })).toBe(true);
    expect(beats({ score: 3, of: 5 }, { score: 3, of: 5 })).toBe(false);
    expect(beats({ score: 2, of: 5 }, { score: 3, of: 5 })).toBe(false);
  });
  it('compares shares when the number of rounds changed', () => {
    expect(beats({ score: 3, of: 3 }, { score: 4, of: 5 })).toBe(true);
    expect(beats({ score: 4, of: 4 }, { score: 3, of: 3 })).toBe(true);
    expect(beats({ score: 2, of: 4 }, { score: 2, of: 3 })).toBe(false);
  });
});

describe('mergeBests', () => {
  it('keeps the best of both, route by route', () => {
    expect(mergeBests({ a: { score: 2, of: 5 }, b: { score: 5, of: 5 } }, { a: { score: 4, of: 5 }, c: { score: 1, of: 3 } })).toEqual({
      a: { score: 4, of: 5 },
      b: { score: 5, of: 5 },
      c: { score: 1, of: 3 },
    });
  });
});

describe('recordScore', () => {
  beforeEach(async () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
      addEventListener() {},
      removeEventListener() {},
    };
  });

  it('saves a new best, says so, and ignores worse games', async () => {
    const { recordScore } = await import('./quiz-best');
    expect(recordScore('r1', 3, 5)).toBe(true);
    expect(recordScore('r1', 2, 5)).toBe(false);
    expect(recordScore('r1', 4, 5)).toBe(true);
    expect(parseBests((globalThis as unknown as { window: Window }).window.localStorage.getItem(QUIZ_BEST_KEY))).toEqual({ r1: { score: 4, of: 5 } });
    // A first game with no right answers is kept, but isn't announced as a best.
    expect(recordScore('r2', 0, 4)).toBe(false);
    expect(recordScore('r1', 9, 5)).toBe(false);
  });
});

describe('subscribing again', () => {
  it("takes in another tab's scores saved while nothing here listened", async () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
      addEventListener() {},
      removeEventListener() {},
    };
    const { vi } = await import('vitest');
    vi.resetModules();
    const { bestsNow, subscribeBests } = await import('./quiz-best');
    expect(bestsNow()).toEqual({});
    // The passport was opened and closed, then another tab saved a score.
    subscribeBests(() => {})();
    store.set(QUIZ_BEST_KEY, JSON.stringify({ r: { score: 3, of: 4 } }));
    const stale = bestsNow();
    subscribeBests(() => {})();
    expect(bestsNow()).toEqual({ r: { score: 3, of: 4 } });
    expect(bestsNow()).not.toBe(stale);
    // Nothing new: the same object, so React doesn't re-render for nothing.
    const same = bestsNow();
    subscribeBests(() => {})();
    expect(bestsNow()).toBe(same);
  });
});
