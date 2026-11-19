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
    // Marked again while still visited: the first day stays.
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

  it("keeps a date it couldn't save when the stored dates are read again", async () => {
    const { toggleVisited } = await import('./visited');
    const { recordVisitDate } = await import('./visit-dates');
    const ls = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    const setItem = ls.setItem;
    // Storage is full for the dates (the visited set still saves).
    ls.setItem = (k, v) => {
      if (k === VISIT_DATES_KEY) throw new Error('QuotaExceededError');
      setItem(k, v);
    };
    toggleVisited(5);
    toggleVisited(9); // reads the stored dates again: 5 must not be lost
    expect(stored()).toEqual({});
    // Room again: the next save writes both.
    ls.setItem = setItem;
    toggleVisited(10);
    expect(stored()).toEqual({ 5: '2026-11-17', 9: '2026-11-17', 10: '2026-11-17' });
  });

  // Makes this tab's date writes fail until the returned function is called.
  const failDateWrites = () => {
    const ls = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    const setItem = ls.setItem;
    ls.setItem = (k, v) => {
      if (k === VISIT_DATES_KEY) throw new Error('QuotaExceededError');
      setItem(k, v);
    };
    return () => {
      ls.setItem = setItem;
    };
  };

  it('dates a place marked again on a later day afresh, over a date a failed forget left behind', async () => {
    store.set('cairo-walks:visited', JSON.stringify([201]));
    store.set(VISIT_DATES_KEY, JSON.stringify({ 201: '2026-11-15' }));
    const { toggleVisited } = await import('./visited');
    const restore = failDateWrites();
    toggleVisited(201); // tab A unmarks 201, but its date stays in storage
    expect(stored()).toEqual({ 201: '2026-11-15' });
    restore();
    // Tab B (same storage, its own copy of the stores) marks 201 again on the 17th.
    vi.resetModules();
    const tabB = await import('./visited');
    tabB.toggleVisited(201);
    expect(stored()).toEqual({ 201: '2026-11-17' });
    // Tab A saves again later: its unsaved forget isn't replayed over the new visit.
    toggleVisited(7);
    expect(stored()).toEqual({ 201: '2026-11-17', 7: '2026-11-17' });
  });

  it('keeps visits and their dates for the session when storage can be read but not written', async () => {
    const ls = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    ls.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const { toggleVisited, markVisited } = await import('./visited');
    const { forgetVisitDates, getVisitDates } = await import('./visit-dates');
    toggleVisited(5);
    markVisited(6); // the second visit doesn't wipe out the first
    forgetVisitDates([99]); // a later refresh of the dates keeps both
    expect(getVisitDates()).toEqual({ 5: '2026-11-17', 6: '2026-11-17' });
  });

  it('replays changes it couldn\'t save as they are until the visited check is set', async () => {
    const { recordVisitDate, forgetVisitDates } = await import('./visit-dates'); // visited.ts never loaded
    const restore = failDateWrites();
    recordVisitDate(5);
    forgetVisitDates([5]);
    recordVisitDate(6);
    restore();
    recordVisitDate(7);
    expect(stored()).toEqual({ 6: '2026-11-17', 7: '2026-11-17' });
  });

  it("doesn't replay a date it couldn't save for a place another tab unmarked since", async () => {
    const { toggleVisited } = await import('./visited');
    const restore = failDateWrites();
    toggleVisited(201); // tab A marks 201; its date isn't saved
    restore();
    // Tab B unmarks 201.
    store.set('cairo-walks:visited', JSON.stringify([]));
    toggleVisited(7); // tab A saves again
    expect(stored()).toEqual({ 7: '2026-11-17' });
  });

  it('dates a visit marked again after another tab walked the route again', async () => {
    const { toggleVisited, markVisited } = await import('./visited');
    toggleVisited(5); // visited on the 17th, in this tab's copy too
    // Another tab walks the route again: both stores cleared, and this tab hasn't heard yet.
    store.set('cairo-walks:visited', JSON.stringify([]));
    store.set(VISIT_DATES_KEY, JSON.stringify({}));
    vi.setSystemTime(new Date('2026-11-19T08:00:00Z'));
    markVisited(5); // walk mode
    expect(JSON.parse(store.get('cairo-walks:visited')!)).toEqual([5]);
    expect(stored()).toEqual({ 5: '2026-11-19' });
  });

  it('gives no date to a place already visited before dates were kept', async () => {
    store.set('cairo-walks:visited', JSON.stringify([7]));
    const { markVisited } = await import('./visited');
    markVisited(7);
    expect(stored()).toEqual({});
  });
});
