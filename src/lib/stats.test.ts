import { describe, expect, it } from 'vitest';
import { addEvents, cleanEvents, dayKey, emptyDay, MAX_EVENTS_PER_REQUEST, parseDay, sumDays } from './stats';

const known = { placeIds: new Set([1, 2]), routeIds: new Set(['ahl-al-bayt']) };

describe('cleanEvents', () => {
  it('keeps only well-formed events for known places and routes', () => {
    const raw = [
      { t: 'play', id: 1 },
      { t: 'arrive', id: 2 },
      { t: 'route', id: 'ahl-al-bayt' },
      { t: 'play', id: 99 }, // unknown place
      { t: 'route', id: 'nope' }, // unknown route
      { t: 'play', id: '1' }, // wrong type
      { t: 'route', id: 1 },
      { t: 'click', id: 1 },
      null,
      'x',
    ];
    expect(cleanEvents(raw, known)).toEqual([{ t: 'play', id: 1 }, { t: 'arrive', id: 2 }, { t: 'route', id: 'ahl-al-bayt' }]);
  });

  it('ignores non-arrays and caps the batch size', () => {
    expect(cleanEvents({ t: 'play', id: 1 }, known)).toEqual([]);
    expect(cleanEvents(Array(500).fill({ t: 'play', id: 1 }), known)).toHaveLength(MAX_EVENTS_PER_REQUEST);
  });
});

describe('addEvents / sumDays / parseDay', () => {
  it('counts events into the right totals', () => {
    const day = addEvents(emptyDay(), [{ t: 'play', id: 1 }, { t: 'play', id: 1 }, { t: 'route', id: 'r' }, { t: 'arrive', id: 2 }]);
    expect(day).toEqual({ plays: { 1: 2 }, routes: { r: 1 }, arrivals: { 2: 1 } });
  });

  it('adds days together', () => {
    const a = addEvents(emptyDay(), [{ t: 'play', id: 1 }]);
    const b = addEvents(emptyDay(), [{ t: 'play', id: 1 }, { t: 'play', id: 2 }]);
    expect(sumDays([a, b]).plays).toEqual({ 1: 2, 2: 1 });
  });

  it('drops malformed stored values', () => {
    expect(parseDay({ plays: { 1: 3, 2: -1, 3: 1.5, 4: 'x' }, routes: 'bad' })).toEqual({ plays: { 1: 3 }, routes: {}, arrivals: {} });
    expect(parseDay(null)).toEqual(emptyDay());
  });

  it('keys days by UTC date', () => {
    expect(dayKey(new Date('2026-11-05T23:59:00Z'))).toBe('2026-11-05');
  });
});
