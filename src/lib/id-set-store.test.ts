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
