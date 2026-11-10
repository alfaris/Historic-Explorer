import { describe, expect, it } from 'vitest';
import { MIN_PLAYS, suggestCount, suggestMustSee } from './must-see-suggest';
import { emptyDay } from '../lib/stats';

const stats = (plays: Record<number, number>, arrivals: Record<number, number> = {}) => ({
  ...emptyDay(),
  plays: Object.fromEntries(Object.entries(plays)),
  arrivals: Object.fromEntries(Object.entries(arrivals)),
});

describe('suggestCount', () => {
  it('is a third of the stops, at least 2 and at most 6', () => {
    expect([2, 3, 4, 9, 12, 20, 35].map(suggestCount)).toEqual([2, 2, 2, 3, 4, 6, 6]);
    expect(suggestCount(1)).toBe(1);
  });
});

describe('suggestMustSee', () => {
  const stops = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  it('ranks by audio plays and arrivals, best first', () => {
    const s = suggestMustSee(stops, stats({ 1: 5, 2: 20, 3: 1, 4: 8, 9: 12 }, { 4: 10, 9: 1 }));
    expect(s).toEqual({
      kind: 'ok',
      picks: [
        { id: 2, plays: 20, arrivals: 0, score: 20 },
        { id: 4, plays: 8, arrivals: 10, score: 18 },
        { id: 9, plays: 12, arrivals: 1, score: 13 },
      ],
    });
  });

  it("leaves out stops no one played or arrived at, even to fill the count", () => {
    const s = suggestMustSee([1, 2, 3, 4, 5, 6], stats({ 1: 25 }));
    expect(s.kind === 'ok' && s.picks.map(p => p.id)).toEqual([1]);
  });

  it('breaks ties by walking order', () => {
    const s = suggestMustSee([7, 3, 5], stats({ 7: 10, 3: 10, 5: 10 }));
    expect(s.kind === 'ok' && s.picks.map(p => p.id)).toEqual([7, 3]);
  });

  it('only counts the route stops it is given', () => {
    const s = suggestMustSee([1, 2, 3], stats({ 1: 1, 2: 1, 3: 1, 99: 500 }));
    expect(s).toEqual({ kind: 'tooLittle', plays: 3 });
  });

  it(`says so with fewer than ${MIN_PLAYS} plays on the route`, () => {
    expect(suggestMustSee(stops, stats({ 1: MIN_PLAYS - 1 }, { 1: 50 }))).toEqual({ kind: 'tooLittle', plays: MIN_PLAYS - 1 });
    expect(suggestMustSee(stops, stats({ 1: MIN_PLAYS })).kind).toBe('ok');
  });
});
