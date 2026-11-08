import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORECAST_KEY, loadForecast, readCachedForecast } from './weather-store';

const reply = { hourly: { time: [1_800_000_000], temperature_2m: [30], uv_index: [5] } };
let calls = 0;
let online = true;

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal('navigator', { get onLine() { return online; } });
  calls = 0;
  online = true;
  vi.stubGlobal('fetch', async () => {
    calls++;
    return new Response(JSON.stringify(reply));
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('loadForecast', () => {
  it('fetches once, keeps it, and reuses it for an hour', async () => {
    const f = await loadForecast(Date.now());
    expect(f?.hours).toEqual([{ t: 1_800_000_000_000, temp: 30, uv: 5 }]);
    expect(readCachedForecast()?.fetchedAt).toBe(f!.fetchedAt);
    await loadForecast(Date.now() + 30 * 60_000);
    expect(calls).toBe(1);
    await loadForecast(Date.now() + 61 * 60_000);
    expect(calls).toBe(2);
  });

  it('shares one request between callers', async () => {
    await Promise.all([loadForecast(), loadForecast(), loadForecast()]);
    expect(calls).toBe(1);
  });

  it('offline or failing, gives the kept one (or nothing), and fetches once back online', async () => {
    online = false;
    expect(await loadForecast()).toBeNull();
    expect(calls).toBe(0);
    online = true;
    vi.stubGlobal('fetch', async () => { calls++; throw new Error('down'); });
    expect(await loadForecast()).toBeNull();
    vi.stubGlobal('fetch', async () => { calls++; return new Response(JSON.stringify(reply)); });
    expect((await loadForecast())?.hours).toHaveLength(1);
    expect(calls).toBe(2);
    expect(localStorage.getItem(FORECAST_KEY)).toContain('"temp":30');
  });
});
