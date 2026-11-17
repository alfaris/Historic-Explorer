import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VISIT_DATES_KEY, parseVisitDates, visitsByDay } from './visit-dates';

describe('parseVisitDates', () => {
  it('keeps only a date for a place ID', () => {
    expect(parseVisitDates(JSON.stringify({ 1: '2026-11-17', 2: 'yesterday', x: '2026-11-17', 0: '2026-11-17', 3: 5 }))).toEqual({ 1: '2026-11-17' });
    expect(parseVisitDates('{oops')).toEqual({});
    expect(parseVisitDates('[1]')).toEqual({});
    expect(parseVisitDates(null)).toEqual({});
  });
});

describe('visitsByDay', () => {
  it('groups visited places by day, newest first, then the undated ones', () => {
    const days = visitsByDay(new Set([1, 2, 3, 4, 99]), { 1: '2026-11-15', 2: '2026-11-17', 3: '2026-11-15' }, [4, 3, 2, 1]);
    expect(days).toEqual([
      { date: '2026-11-17', ids: [2] },
      { date: '2026-11-15', ids: [3, 1] },
      { date: null, ids: [4] },
    ]);
  });

  it('leaves out dates of places no longer visited', () => {
    expect(visitsByDay(new Set([1]), { 1: '2026-11-15', 2: '2026-11-17' }, [1, 2])).toEqual([{ date: '2026-11-15', ids: [1] }]);
    expect(visitsByDay(new Set(), { 1: '2026-11-15' }, [1])).toEqual([]);
  });
});

describe('marking visits', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
      addEventListener() {},
      removeEventListener() {},
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T21:30:00Z')); // 23:30 in Cairo
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const stored = () => parseVisitDates(store.get(VISIT_DATES_KEY) ?? null);

  it("records the Cairo day a place is first marked, and forgets it when unmarked", async () => {
    const { toggleVisited, markVisited, clearVisited } = await import('./visited');
    toggleVisited(5);
    expect(stored()).toEqual({ 5: '2026-11-17' });
    // Marked again the next day: the first day stays.
    vi.setSystemTime(new Date('2026-11-18T08:00:00Z'));
    markVisited(5);
    markVisited(6);
    expect(stored()).toEqual({ 5: '2026-11-17', 6: '2026-11-18' });
    toggleVisited(5);
    expect(stored()).toEqual({ 6: '2026-11-18' });
    clearVisited([6]);
    expect(stored()).toEqual({});
  });

  it('keeps a date another tab removed removed, and dates a later visit afresh', async () => {
    const { toggleVisited } = await import('./visited');
    const { recordVisitDate } = await import('./visit-dates');
    toggleVisited(5); // this tab: 5 visited on the 17th (and cached)
    // Another tab unmarks 5: its date leaves storage, the visited set too.
    store.set(VISIT_DATES_KEY, JSON.stringify({}));
    store.set('cairo-walks:visited', JSON.stringify([]));
    recordVisitDate(8); // this tab writes again
    expect(stored()).toEqual({ 8: '2026-11-17' });
    vi.setSystemTime(new Date('2026-11-20T08:00:00Z'));
    toggleVisited(5); // visited again three days later
    expect(stored()).toEqual({ 8: '2026-11-17', 5: '2026-11-20' });
  });

  it('gives no date to a place already visited before dates were kept', async () => {
    store.set('cairo-walks:visited', JSON.stringify([7]));
    const { markVisited } = await import('./visited');
    markVisited(7);
    expect(stored()).toEqual({});
  });
});
