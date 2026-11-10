import { describe, expect, it } from 'vitest';
import { audioCount, generateAllMissing, generateMissing, mapLimit, type PlaceAudio } from './route-audio';
import type { AudioState } from './api';

const st = (status: AudioState['status'], version: string | null = 'v'): AudioState => ({ status, version });
const place = (id: number, fr: AudioState): PlaceAudio => ({
  id,
  name: `Place ${id}`,
  states: { en: st('stored'), ar: st('stored'), fr, es: st('missing') },
});

describe('audioCount', () => {
  it('counts ready audio among places that can have it', () => {
    const places = [place(1, st('stored')), place(2, st('missing')), place(3, st('no-text', null)), place(4, st('missing'))];
    const c = audioCount(places, 'fr');
    expect([c.ready, c.total]).toEqual([1, 3]);
    expect(c.missing.map(p => p.id)).toEqual([2, 4]);
    expect(audioCount(places, 'en')).toMatchObject({ ready: 4, total: 4, missing: [] });
  });
  it('leaves out places with no Blob store', () => {
    expect(audioCount([place(1, st('unavailable'))], 'fr')).toMatchObject({ ready: 0, total: 0 });
  });
});

describe('generateMissing', () => {
  const missing = [place(1, st('missing', 'a')), place(2, st('missing', 'b')), place(3, st('missing', 'c'))];
  const opts = (log: number[] = [], cancelAfter = Infinity) => ({ cancelled: () => log.length >= cancelAfter, onGenerated: (id: number) => log.push(id) });

  it('generates each one in turn with its version', async () => {
    const calls: string[] = [];
    const log: number[] = [];
    const r = await generateMissing(missing, 'fr', async (id, lang, v) => calls.push(`${id}:${lang}:${v}`), opts(log));
    expect(r).toEqual({ kind: 'done', generated: 3 });
    expect(calls).toEqual(['1:fr:a', '2:fr:b', '3:fr:c']);
    expect(log).toEqual([1, 2, 3]);
  });
  it('stops at the server limit, keeping what was made', async () => {
    const r = await generateMissing(missing, 'fr', async id => {
      if (id === 2) throw Object.assign(new Error('Too many'), { status: 429 });
    }, opts());
    expect(r).toEqual({ kind: 'limited', generated: 1 });
  });
  it('stops at another failure, naming the place', async () => {
    const r = await generateMissing(missing, 'fr', async id => {
      if (id === 3) throw Object.assign(new Error('Unsaved changes'), { status: 409 });
    }, opts());
    expect(r).toEqual({ kind: 'failed', generated: 2, place: 'Place 3', message: 'Unsaved changes' });
  });
  it('stops when cancelled', async () => {
    const r = await generateMissing(missing, 'fr', async () => {}, opts([], 1));
    expect(r).toEqual({ kind: 'cancelled', generated: 1 });
  });
});

describe('mapLimit', () => {
  it('keeps the order and never runs more than the limit at once', async () => {
    let running = 0;
    let most = 0;
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async n => {
      running++;
      most = Math.max(most, running);
      await new Promise(r => setTimeout(r, n));
      running--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(most).toBe(2);
  });
});

describe('generateAllMissing', () => {
  const missing = [place(1, st('missing', 'a')), place(2, st('missing', 'b')), place(3, st('missing', 'c'))];
  const noWait = async () => {};

  it('carries on after a place fails, listing it', async () => {
    const log: number[] = [];
    const r = await generateAllMissing(missing, 'fr', async id => {
      if (id === 2) throw new Error('Gemini said no');
    }, { cancelled: () => false, onGenerated: id => log.push(id), wait: noWait });
    expect(r).toEqual({ generated: 2, cancelled: false, failures: [{ place: 'Place 2', message: 'Gemini said no' }] });
    expect(log).toEqual([1, 3]);
  });

  it('waits at the server limit and tries the same place again', async () => {
    let limited = 2;
    const calls: number[] = [];
    const paused: boolean[] = [];
    let waited = 0;
    const r = await generateAllMissing(missing, 'fr', async id => {
      calls.push(id);
      if (id === 2 && limited-- > 0) throw Object.assign(new Error('Too many'), { status: 429 });
    }, { cancelled: () => false, onGenerated: () => {}, onPaused: p => paused.push(p), wait: async ms => void (waited += ms), pauseMs: 3000 });
    expect(r).toEqual({ generated: 3, cancelled: false, failures: [] });
    expect(calls).toEqual([1, 2, 2, 2, 3]);
    expect(paused).toEqual([true, false, true, false]);
    expect(waited).toBe(6000);
  });

  it('stops when cancelled, also during a wait', async () => {
    let stop = false;
    const r = await generateAllMissing(missing, 'fr', async id => {
      if (id === 2) {
        stop = true;
        throw Object.assign(new Error('Too many'), { status: 429 });
      }
    }, { cancelled: () => stop, onGenerated: () => {}, wait: noWait });
    expect(r).toEqual({ generated: 1, cancelled: true, failures: [] });
  });
});
