import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_KEY, flush, resetTrackingForTest, sendPending, track } from './track';

let beacons: string[];
let nav: Record<string, unknown>;
let store: Map<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  beacons = [];
  nav = {
    sendBeacon: (_url: string, body: Blob) => {
      body.text().then(t => beacons.push(t));
      return true;
    },
  };
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
  vi.stubGlobal('window', { addEventListener: () => {} });
  store = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  resetTrackingForTest();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const sent = async () => {
  await vi.runAllTimersAsync();
  return beacons.map(b => JSON.parse(b).events);
};

describe('track', () => {
  it('batches events and counts each one once per visit', async () => {
    track({ t: 'play', id: 1 });
    track({ t: 'play', id: 1 });
    track({ t: 'route', id: 'ahl-al-bayt' });
    expect(beacons).toEqual([]); // not sent straight away
    expect(await sent()).toEqual([[{ t: 'play', id: 1 }, { t: 'route', id: 'ahl-al-bayt' }]]);
  });

  it('sends nothing for visitors who opt out', async () => {
    nav.globalPrivacyControl = true;
    track({ t: 'play', id: 1 });
    nav.globalPrivacyControl = false;
    nav.doNotTrack = '1';
    track({ t: 'play', id: 2 });
    flush();
    expect(await sent()).toEqual([]);
  });

  it('sends the batch right away on flush (page hidden or closed)', async () => {
    track({ t: 'arrive', id: 5 });
    flush();
    await Promise.resolve();
    expect(await sent()).toEqual([[{ t: 'arrive', id: 5 }]]);
  });

  it('sends nothing when there is nothing queued', async () => {
    flush();
    expect(await sent()).toEqual([]);
  });

  it('keeps events made with no connection, and sends them once back online', async () => {
    nav.onLine = false;
    track({ t: 'up', id: 3 });
    flush();
    expect(beacons).toEqual([]);
    expect(JSON.parse(store.get(PENDING_KEY)!)).toEqual([{ t: 'up', id: 3 }]);
    nav.onLine = true;
    sendPending();
    expect(await sent()).toEqual([[{ t: 'up', id: 3 }]]);
    expect(store.has(PENDING_KEY)).toBe(false);
  });
});
