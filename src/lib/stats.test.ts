import { describe, expect, it } from 'vitest';
import { addEvents, cleanEvents, dayKey, emptyDay, helpfulness, languageShares, MAX_EVENTS_PER_REQUEST, parseDay, routeRatings, sumDays } from './stats';

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
    expect(day).toEqual({ plays: { 1: 2 }, routes: { r: 1 }, arrivals: { 2: 1 }, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {}, langs: {} });
  });

  it('adds days together', () => {
    const a = addEvents(emptyDay(), [{ t: 'play', id: 1 }]);
    const b = addEvents(emptyDay(), [{ t: 'play', id: 1 }, { t: 'play', id: 2 }]);
    expect(sumDays([a, b]).plays).toEqual({ 1: 2, 2: 1 });
  });

  it('drops malformed stored values', () => {
    expect(parseDay({ plays: { 1: 3, 2: -1, 3: 1.5, 4: 'x' }, routes: 'bad' })).toEqual({ plays: { 1: 3 }, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {}, langs: {} });
    expect(parseDay(null)).toEqual(emptyDay());
  });

  it('counts helpful votes for known places, and reads days stored before votes existed', () => {
    const known = { placeIds: new Set([1]), routeIds: new Set<string>() };
    const events = cleanEvents([{ t: 'up', id: 1 }, { t: 'down', id: 1 }, { t: 'up', id: 9 }, { t: 'up', id: '1' }], known);
    expect(events).toEqual([{ t: 'up', id: 1 }, { t: 'down', id: 1 }]);
    expect(addEvents(emptyDay(), events)).toMatchObject({ helpful: { 1: 1 }, unhelpful: { 1: 1 } });
    expect(parseDay({ plays: { 1: 2 } })).toEqual({ plays: { 1: 2 }, routes: {}, arrivals: {}, helpful: {}, unhelpful: {}, reasons: {}, ratings: {}, routeReasons: {}, langs: {} });
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

describe('route ratings', () => {
  const known = { placeIds: new Set([1]), routeIds: new Set(['al-muizz', 'coptic-cairo']) };
  it('keeps ratings of 1 to 5 stars and low-rating reasons for known routes', () => {
    const events = cleanEvents(
      [
        { t: 'rate', id: 'al-muizz', s: 5 },
        { t: 'rate', id: 'al-muizz', s: 2 },
        { t: 'rate', id: 'al-muizz', s: 6 },
        { t: 'rate', id: 'al-muizz', s: 3.5 },
        { t: 'rate', id: 'nowhere', s: 4 },
        { t: 'rwhy', id: 'al-muizz', r: 'hot' },
        { t: 'rwhy', id: 'al-muizz', r: 'boring' },
      ],
      known,
    );
    expect(events).toEqual([
      { t: 'rate', id: 'al-muizz', s: 5 },
      { t: 'rate', id: 'al-muizz', s: 2 },
      { t: 'rwhy', id: 'al-muizz', r: 'hot' },
    ]);
    const day = addEvents(emptyDay(), events);
    expect(day.ratings).toEqual({ 'al-muizz:5': 1, 'al-muizz:2': 1 });
    expect(day.routeReasons).toEqual({ 'al-muizz:hot': 1 });
  });
  it('reads stored ratings, dropping malformed keys, and days stored before ratings existed', () => {
    expect(parseDay({ ratings: { 'al-muizz:4': 2, 'al-muizz:9': 1, 'Bad Id:3': 1 }, routeReasons: { 'al-muizz:hot': 1, 'al-muizz:boring': 2 } })).toMatchObject({
      ratings: { 'al-muizz:4': 2 },
      routeReasons: { 'al-muizz:hot': 1 },
    });
    expect(parseDay({ plays: { 1: 1 } }).ratings).toEqual({});
  });
  it('averages each route, leaving out routes without ratings', () => {
    const total = { ...emptyDay(), ratings: { 'al-muizz:5': 2, 'al-muizz:2': 1 }, routeReasons: { 'al-muizz:hot': 1 } };
    expect(routeRatings(total, ['al-muizz', 'coptic-cairo'])).toEqual([{ id: 'al-muizz', count: 3, average: 4, reasons: { hot: 1 } }]);
  });
});

describe('languages', () => {
  it('keeps a known language on plays and route opens only', () => {
    const raw = [
      { t: 'play', id: 1, l: 'fr' },
      { t: 'route', id: 'ahl-al-bayt', l: 'ar' },
      { t: 'play', id: 2, l: 'de' }, // unknown language: counted, without it
      { t: 'arrive', id: 2, l: 'es' }, // arrivals don't carry one
    ];
    expect(cleanEvents(raw, known)).toEqual([{ t: 'play', id: 1, l: 'fr' }, { t: 'route', id: 'ahl-al-bayt', l: 'ar' }, { t: 'play', id: 2 }, { t: 'arrive', id: 2 }]);
  });

  it('counts them per language, and reads days stored before languages', () => {
    const day = addEvents(emptyDay(), [{ t: 'play', id: 1, l: 'fr' }, { t: 'play', id: 2, l: 'fr' }, { t: 'route', id: 'r', l: 'en' }, { t: 'play', id: 1 }]);
    expect(day.langs).toEqual({ 'play:fr': 2, 'route:en': 1 });
    expect(day.plays).toEqual({ 1: 2, 2: 1 });
    expect(parseDay({ langs: { 'play:fr': 2, 'play:de': 1, 'arrive:en': 1, 'route:ar': 0 } }).langs).toEqual({ 'play:fr': 2 });
    expect(parseDay({ plays: { 1: 1 } }).langs).toEqual({});
  });

  it('gives each language its share, most used first, and says how much was counted', () => {
    const old = addEvents(emptyDay(), [{ t: 'play', id: 1 }, { t: 'route', id: 'r' }]);
    const recent = addEvents(emptyDay(), [
      ...Array(5).fill({ t: 'play', id: 1, l: 'en' }),
      { t: 'route', id: 'r', l: 'en' },
      { t: 'play', id: 2, l: 'ar' },
      { t: 'route', id: 'r', l: 'ar' },
      { t: 'play', id: 2, l: 'es' },
    ]);
    const shares = languageShares(sumDays([old, recent]));
    expect(shares.rows).toEqual([
      { lang: 'en', plays: 5, routes: 1, total: 6, pct: 67 },
      { lang: 'ar', plays: 1, routes: 1, total: 2, pct: 22 },
      { lang: 'es', plays: 1, routes: 0, total: 1, pct: 11 },
    ]);
    expect([shares.counted, shares.all]).toEqual([9, 11]);
    expect(languageShares(emptyDay())).toEqual({ rows: [], counted: 0, all: 0 });
    // Totals from a server without languages.
    const { langs: _, ...noLangs } = old;
    expect(languageShares(noLangs as typeof old).rows).toEqual([]);
  });
});
