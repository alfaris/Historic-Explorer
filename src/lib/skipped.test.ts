import { afterEach, describe, expect, it, vi } from 'vitest';

describe('visiting a skipped stop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  it('undoes the skip, however the stop is marked visited', async () => {
    vi.resetModules();
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const { addSkipped } = await import('./skipped');
    const { markVisited, toggleVisited } = await import('./visited');
    addSkipped(1);
    addSkipped(2);
    markVisited(1); // e.g. arriving with Near me
    toggleVisited(2); // e.g. Mark visited on the card
    expect(JSON.parse(data.get('cairo-walks:skipped')!)).toEqual([]);
    addSkipped(3);
    toggleVisited(4); // a stop that wasn't skipped
    toggleVisited(4); // un-marking doesn't touch skips
    expect(JSON.parse(data.get('cairo-walks:skipped')!)).toEqual([3]);
  });
});
