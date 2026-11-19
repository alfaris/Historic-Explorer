// Operation sequences for the device stores: what the app holds and what's
// written after each step, including a write that fails (storage full),
// another tab's change, and a retry. These are where #236–#246 found bugs.

import type { VectorSet } from './common.js';

type Listener = (e: { key: string | null }) => void;

/** A stand-in for the browser: localStorage whose writes can fail, and other tabs' "storage" events. */
function fakeBrowser() {
  const data = new Map<string, string>();
  const listeners = new Set<Listener>();
  let failWrites = false;
  const window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrites) throw new Error('QuotaExceededError');
        data.set(k, v);
      },
    },
    addEventListener: (type: string, l: Listener) => type === 'storage' && listeners.add(l),
    removeEventListener: (type: string, l: Listener) => type === 'storage' && listeners.delete(l),
  };
  const g = globalThis as { window?: unknown };
  const previous = g.window;
  g.window = window;
  return {
    data,
    setFailWrites: (on: boolean) => void (failWrites = on),
    /** Another tab saved `raw` under `key`. */
    external: (key: string, raw: string) => {
      data.set(key, raw);
      listeners.forEach(l => l({ key }));
    },
    restore: () => void (g.window = previous),
  };
}

type IdOp =
  | { op: 'add'; id: number }
  | { op: 'toggle'; id: number }
  | { op: 'remove'; ids: number[] }
  | { op: 'failWrites'; on: boolean }
  | { op: 'external'; raw: string }
  | { op: 'reload' };

const ID_KEY = 'vectors:ids';

const ID_SEQUENCES: { name: string; ops: IdOp[] }[] = [
  { name: 'basics', ops: [{ op: 'toggle', id: 5 }, { op: 'add', id: 2 }, { op: 'add', id: 2 }, { op: 'toggle', id: 5 }, { op: 'remove', ids: [2, 9] }] },
  { name: 'builds on another tab', ops: [{ op: 'add', id: 1 }, { op: 'external', raw: '[1,9]' }, { op: 'add', id: 3 }] },
  {
    name: 'failed writes are kept and saved later',
    ops: [{ op: 'add', id: 1 }, { op: 'failWrites', on: true }, { op: 'add', id: 5 }, { op: 'add', id: 6 }, { op: 'remove', ids: [1] }, { op: 'failWrites', on: false }, { op: 'add', id: 7 }],
  },
  {
    name: 'another tab saving drops unsaved changes',
    ops: [{ op: 'add', id: 1 }, { op: 'failWrites', on: true }, { op: 'add', id: 5 }, { op: 'external', raw: '[1,8]' }, { op: 'failWrites', on: false }, { op: 'add', id: 2 }],
  },
  { name: 'another tab re-saves the same set', ops: [{ op: 'failWrites', on: true }, { op: 'toggle', id: 4 }, { op: 'external', raw: '[]' }, { op: 'failWrites', on: false }, { op: 'reload' }] },
  { name: 'malformed storage', ops: [{ op: 'external', raw: '[1,"2",-3,4.5,6]' }, { op: 'add', id: 2 }, { op: 'external', raw: '{"a":1}' }, { op: 'reload' }] },
];

export const idSetStoreVectors: VectorSet = {
  name: 'id-set-store',
  build: () => {
    const cases = ID_SEQUENCES.map(seq => {
      const browser = fakeBrowser();
      try {
        // A fresh module per sequence, as on page load.
        let store = loadIdSetStore();
        const steps = seq.ops.map(op => {
          if (op.op === 'add') store.add(op.id);
          else if (op.op === 'toggle') store.toggle(op.id);
          else if (op.op === 'remove') store.remove(op.ids);
          else if (op.op === 'failWrites') browser.setFailWrites(op.on);
          else if (op.op === 'external') browser.external(ID_KEY, op.raw);
          else if (op.op === 'reload') store = loadIdSetStore();
          return { do: op, held: [...store.get()].sort((a, b) => a - b), stored: browser.data.get(ID_KEY) ?? null };
        });
        return { name: seq.name, steps };
      } finally {
        browser.restore();
      }
    });
    return {
      about:
        'A set of place IDs kept on the device (createIdSetStore in src/lib/id-set-store.ts: visited and saved places). Each case starts from empty storage and runs ' +
        'its steps in order; each step is the operation (`do`), then `held`, the IDs the app holds after it, and `stored` the stored text (null when nothing is stored). `failWrites` makes storage writes ' +
        'fail (storage full) until turned off; `external` is another tab saving `raw` (with its storage event); `reload` starts the store again from storage. ' +
        'A change builds on the latest stored set plus this tab\'s unsaved changes; another tab\'s save drops the unsaved changes.',
      cases,
    };
  },
};

let createIdSetStore: (key: string) => { add(id: number): boolean; toggle(id: number): void; remove(ids: number[]): void; get(): Set<number> };
const loadIdSetStore = () => createIdSetStore(ID_KEY);

type DateOp =
  | { op: 'record'; id: number; at: string }
  | { op: 'forget'; ids: number[] }
  | { op: 'visited'; ids: number[] }
  | { op: 'failWrites'; on: boolean }
  | { op: 'external'; raw: string };

const DATES_KEY = 'cairo-walks:visit-dates';

const DATE_SEQUENCES: { name: string; ops: DateOp[] }[] = [
  {
    name: 'records the Cairo date',
    ops: [{ op: 'record', id: 1, at: '2026-12-01T21:59:00Z' }, { op: 'record', id: 2, at: '2026-12-01T22:00:00Z' }, { op: 'record', id: 3, at: '2026-07-01T21:00:00Z' }, { op: 'forget', ids: [1, 9] }],
  },
  {
    name: 'a failed save is kept and written later',
    ops: [{ op: 'failWrites', on: true }, { op: 'record', id: 1, at: '2026-12-01T10:00:00Z' }, { op: 'external', raw: '{"7":"2026-11-30"}' }, { op: 'failWrites', on: false }, { op: 'record', id: 2, at: '2026-12-02T10:00:00Z' }],
  },
  {
    name: 'an unsaved date is dropped once the place is no longer visited',
    ops: [{ op: 'visited', ids: [1] }, { op: 'failWrites', on: true }, { op: 'record', id: 1, at: '2026-12-01T10:00:00Z' }, { op: 'visited', ids: [] }, { op: 'external', raw: '{}' }, { op: 'failWrites', on: false }, { op: 'record', id: 2, at: '2026-12-02T10:00:00Z' }],
  },
  {
    name: 'an unsaved forget is dropped once the place is visited again',
    ops: [{ op: 'visited', ids: [1] }, { op: 'record', id: 1, at: '2026-12-01T10:00:00Z' }, { op: 'failWrites', on: true }, { op: 'visited', ids: [] }, { op: 'forget', ids: [1] }, { op: 'visited', ids: [1] }, { op: 'external', raw: '{"1":"2026-12-03"}' }, { op: 'failWrites', on: false }, { op: 'record', id: 2, at: '2026-12-04T10:00:00Z' }],
  },
  { name: 'malformed storage', ops: [{ op: 'external', raw: '{"1":"2026-12-01","0":"2026-12-01","x":"2026-12-01","2":"12/01/2026","3":5}' }, { op: 'record', id: 4, at: '2026-12-02T10:00:00Z' }] },
];

export const visitDatesVectors: VectorSet = {
  name: 'visit-dates',
  build: async () => {
    const cases = [];
    for (const seq of DATE_SEQUENCES) {
      const browser = fakeBrowser();
      try {
        // The store keeps module-level state: reset per sequence, as on a page load.
        const m = await import('../../src/lib/visit-dates.js');
        m._resetVisitDates();
        let visited = new Set<number>();
        let checked = false;
        // The passport is open: the store listens for other tabs' changes.
        const unsubscribe = m.subscribeVisitDates(() => {});
        const steps = [];
        for (const op of seq.ops) {
          if (op.op === 'record') m.recordVisitDate(op.id, new Date(op.at));
          else if (op.op === 'forget') m.forgetVisitDates(op.ids);
          else if (op.op === 'visited') {
            visited = new Set(op.ids);
            if (!checked) m.setVisitedCheck((id: number) => visited.has(id));
            checked = true;
          } else if (op.op === 'failWrites') browser.setFailWrites(op.on);
          else if (op.op === 'external') browser.external(DATES_KEY, op.raw);
          steps.push({ do: op, held: m.getVisitDates(), stored: browser.data.get(DATES_KEY) ?? null });
        }
        unsubscribe();
        cases.push({ name: seq.name, steps });
      } finally {
        browser.restore();
      }
    }
    return {
      about:
        'Visit dates kept on the device (src/lib/visit-dates.ts): the Cairo date each place was marked visited. Each case starts from empty storage, with the store ' +
        'listening for other tabs\' changes, and runs its steps in order; each step is the operation (`do`), then `held`, the dates the app holds after it, and `stored`, the stored text. `record` marks a place ' +
        'visited at an instant (UTC), stored as that instant\'s Cairo date; `forget` removes dates; `visited` says which places are visited now (once set, an unsaved date ' +
        'is replayed only for a place still visited, and an unsaved forget only for one no longer visited); `failWrites` and `external` are as in id-set-store.json.',
      cases,
    };
  },
};

export async function loadStores() {
  ({ createIdSetStore } = await import('../../src/lib/id-set-store.js'));
}
