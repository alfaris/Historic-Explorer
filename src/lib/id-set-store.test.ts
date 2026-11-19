import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdSetStore } from './id-set-store';
import { savedByRoute } from './saved';

function fakeWindow(blocked = false) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => { if (blocked) throw new Error('blocked'); return data.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (blocked) throw new Error('blocked'); data.set(k, v); },
  };
  vi.stubGlobal('window', { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {} });
  return data;
}

describe('createIdSetStore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('toggles, adds and removes IDs, and stores them sorted', () => {
    const data = fakeWindow();
    const store = createIdSetStore('test:ids');
    store.toggle(5);
    store.add(2);
    store.add(2);
    expect(data.get('test:ids')).toBe('[2,5]');
    store.toggle(5);
    store.remove([2]);
    expect(data.get('test:ids')).toBe('[]');
  });

  it('builds on the stored set, so another tab’s change is kept', () => {
    const data = fakeWindow();
    const store = createIdSetStore('test:ids');
    store.add(1);
    data.set('test:ids', '[1,9]'); // another tab saved 9
    store.add(3);
    expect(data.get('test:ids')).toBe('[1,3,9]');
  });

  it('keeps changes it couldn’t save when storage can be read but not written, and saves them later', () => {
    const data = fakeWindow();
    data.set('test:ids', '[1]');
    const storage = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const store = createIdSetStore('test:ids');
    store.add(5);
    store.add(6); // builds on the stored set plus 5, not the stored set alone
    store.remove([1]);
    expect([...store.latest()].sort()).toEqual([5, 6]);
    expect(data.get('test:ids')).toBe('[1]');
    storage.setItem = setItem; // room again: the next change writes everything
    store.add(7);
    expect(data.get('test:ids')).toBe('[5,6,7]');
  });

  it('drops changes it couldn’t save once another tab saves', () => {
    const data = fakeWindow();
    let onStorage: ((e: { key: string | null }) => void) | null = null;
    (window as unknown as { addEventListener: (t: string, f: typeof onStorage) => void }).addEventListener = (_t, f) => {
      onStorage = f;
    };
    data.set('test:ids', '[201]');
    const storage = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const store = createIdSetStore('test:ids'); // nothing subscribed: the store listens anyway
    store.remove([201]); // this tab unmarks 201, but can't save it
    expect(store.latest().has(201)).toBe(false);
    // Another tab unmarks and marks 201 again: the stored text ends up the same, but it saved.
    data.set('test:ids', '[]');
    onStorage!({ key: 'test:ids' });
    data.set('test:ids', '[201]');
    onStorage!({ key: 'test:ids' });
    storage.setItem = setItem;
    store.add(204); // this tab's next save keeps the other tab's visit
    expect(data.get('test:ids')).toBe('[201,204]');
  });

  it('tells every subscriber once per storage event from another tab', () => {
    const data = fakeWindow();
    let onStorage: ((e: { key: string | null }) => void) | null = null;
    let added = 0;
    (window as unknown as { addEventListener: (t: string, f: typeof onStorage) => void }).addEventListener = (_t, f) => {
      added++;
      onStorage = f;
    };
    const store = createIdSetStore('test:ids');
    let a = 0;
    let b = 0;
    const offA = store.subscribe(() => a++);
    store.subscribe(() => b++);
    expect(added).toBe(1); // one listener for the store, not one per subscriber
    data.set('test:ids', '[3]');
    onStorage!({ key: 'test:ids' });
    onStorage!({ key: 'other:key' });
    expect([a, b]).toEqual([1, 1]);
    offA();
    onStorage!({ key: null });
    expect([a, b]).toEqual([1, 2]);
    expect([...store.latest()]).toEqual([3]);
  });

  it('drops changes it couldn’t save when the stored set has changed since', () => {
    const data = fakeWindow();
    data.set('test:ids', '[1]');
    const storage = (window as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage;
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const store = createIdSetStore('test:ids');
    store.remove([1]);
    data.set('test:ids', '[1,2]'); // another tab saved (this tab wasn't listening)
    storage.setItem = setItem;
    store.add(3);
    expect(data.get('test:ids')).toBe('[1,2,3]');
  });

  it('keeps working in memory when storage is blocked', () => {
    fakeWindow(true);
    const store = createIdSetStore('test:ids');
    store.add(4);
    store.toggle(6);
    expect([...store.get()].sort()).toEqual([4, 6]);
  });
});

describe('savedByRoute', () => {
  it('groups saved places by route, in order, and drops deleted ones', () => {
    const routes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const places = [{ id: 1, routeId: 'b' }, { id: 2, routeId: 'a' }, { id: 3, routeId: 'b' }, { id: 4, routeId: 'c' }];
    const groups = savedByRoute(new Set([3, 1, 2, 99]), places, routes);
    expect(groups.map(g => [g.route.id, g.places.map(p => p.id)])).toEqual([['a', [2]], ['b', [1, 3]]]);
  });
});
