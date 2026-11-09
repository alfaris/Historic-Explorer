import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECENT_MAX, parseRecent, recentPlaces, withRecent } from './recent';

describe('recently viewed', () => {
  it('puts the newest first, moves a repeat up, and keeps at most 10', () => {
    expect(withRecent([], 5)).toEqual([5]);
    expect(withRecent([3, 2, 1], 4)).toEqual([4, 3, 2, 1]);
    expect(withRecent([3, 2, 1], 2)).toEqual([2, 3, 1]);
    const full = Array.from({ length: RECENT_MAX }, (_, i) => i + 1);
    expect(withRecent(full, 99)).toEqual([99, ...full.slice(0, RECENT_MAX - 1)]);
  });

  it('reads a stored list, dropping anything malformed', () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('nope')).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent('[4, "5", 4, 0, -2, 1.5, 7]')).toEqual([4, 7]);
    expect(parseRecent(JSON.stringify(Array.from({ length: 20 }, (_, i) => i + 1)))).toHaveLength(RECENT_MAX);
  });

  it('shows only places that still exist, in the list order', () => {
    const places = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(recentPlaces([3, 99, 1], places)).toEqual([{ id: 3 }, { id: 1 }]);
  });
});

describe('recently viewed across tabs', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('adds to the latest stored list, not a stale copy', async () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const { addRecent, clearRecent } = await import('./recent');
    const stored = () => JSON.parse(data.get('cairo-walks:recent') ?? '[]');
    addRecent(1); // this tab
    data.set('cairo-walks:recent', '[2,1]'); // another tab opened place 2
    addRecent(3); // this tab again
    expect(stored()).toEqual([3, 2, 1]);
    clearRecent();
    data.set('cairo-walks:recent', '[5]'); // another tab, after the clear
    addRecent(6);
    expect(stored()).toEqual([6, 5]);
  });
});
