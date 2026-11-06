import { describe, expect, it } from 'vitest';
import { addEvents, cleanEvents, dayKey, emptyDay, helpfulness, MAX_EVENTS_PER_REQUEST, parseDay, sumDays } from './stats';

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
    expect(day).toEqual({ plays: { 1: 2 }, routes: { r: 1 }, arrivals: { 2: 1 }, helpful: {}, unhelpful: {}, reasons: {} });
  });

  it('adds days together', () => {
    const a = addEvents(emptyDay(), [{ t: 'play', id: 1 }]);
    const b = addEvents(emptyDay(), [{ t: 'play', id: 1 }, { t: 'play', id: 2 }]);
    expect(sumDays([a, b]).plays).toEqual({ 1: 2, 2: 1 });
  });

  it('drops malformed stored values', () => {
    expect(parseDay({ plays: { 1: 3, 2: -1, 3: 1.5, 4: 'x' }, routes: 'bad' })).toEqual({ plays: { 1: 3 }, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {} });
    expect(parseDay(null)).toEqual(emptyDay());
  });

  it('counts helpful votes for known places, and reads days stored before votes existed', () => {
    const known = { placeIds: new Set([1]), routeIds: new Set<string>() };
    const events = cleanEvents([{ t: 'up', id: 1 }, { t: 'down', id: 1 }, { t: 'up', id: 9 }, { t: 'up', id: '1' }], known);
    expect(events).toEqual([{ t: 'up', id: 1 }, { t: 'down', id: 1 }]);
    expect(addEvents(emptyDay(), events)).toMatchObject({ helpful: { 1: 1 }, unhelpful: { 1: 1 } });
    expect(parseDay({ plays: { 1: 2 } })).toEqual({ plays: { 1: 2 }, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {} });
  });

  it('lists helpfulness per place, most disliked or most voted first', () => {
    const total = { ...emptyDay(), helpful: { 1: 9, 2: 1, 3: 4 }, unhelpful: { 1: 1, 2: 3, 3: 3 } };
    expect(helpfulness(total, [1, 2, 3, 4]).map(r => [r.id, r.yes, r.no, r.pct])).toEqual([[2, 1, 3, 25], [3, 4, 3, 57], [1, 9, 1, 90]]);
    expect(helpfulness(total, [1, 2, 3, 4], 'votes').map(r => r.id)).toEqual([1, 3, 2]);
    expect(helpfulness(total, [5])).toEqual([]); // no votes, or a deleted place's votes
  });

  it('keys days by UTC date', () => {
    expect(dayKey(new Date('2026-11-05T23:59:00Z'))).toBe('2026-11-05');
  });
});

describe('reasons after No', () => {
  const known = { placeIds: new Set([1, 2]), routeIds: new Set(['r']) };
  it('accepts a known reason for a known place, and nothing else', () => {
    const raw = [
      { t: 'why', id: 1, r: 'outdated' },
      { t: 'why', id: 1, r: 'boring' },
      { t: 'why', id: 9, r: 'audio' },
      { t: 'why', id: 2 },
    ];
    expect(cleanEvents(raw, known)).toEqual([{ t: 'why', id: 1, r: 'outdated' }]);
  });
  it('counts them by place and reason, and reads them back', () => {
    const day = addEvents(emptyDay(), [{ t: 'why', id: 1, r: 'outdated' }, { t: 'why', id: 1, r: 'outdated' }, { t: 'why', id: 2, r: 'audio' }]);
    expect(day.reasons).toEqual({ '1:outdated': 2, '2:audio': 1 });
    expect(parseDay({ reasons: { '1:outdated': 2, '1:nope': 3, 'x:audio': 1 } }).reasons).toEqual({ '1:outdated': 2 });
  });
  it('lists each place’s reasons with its votes', () => {
    const total = { ...emptyDay(), unhelpful: { 1: 3 }, reasons: { '1:outdated': 2, '1:audio': 1, '2:short': 4 } };
    expect(helpfulness(total, [1, 2])[0]).toMatchObject({ id: 1, no: 3, reasons: { outdated: 2, audio: 1 } });
  });
});
