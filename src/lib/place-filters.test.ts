import { describe, expect, it } from 'vitest';
import { anyFilter, NO_FILTERS, passesFilters, withoutHours } from './place-filters';

const allWeek = (open: string, close: string) => ({ days: Array.from({ length: 7 }, () => [{ open, close }]) });
const museum = { id: 1, hours: allWeek('09:00', '17:00'), tips: { wheelchair: 'yes' as const } };
const cafe = { id: 2, hours: allWeek('08:00', '23:00'), tips: { wheelchair: 'partial' as const } };
const unknown = { id: 3 };
// 2026-11-06 is a Friday; Cairo is UTC+2 in November.
const at = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00+02:00`);

describe('passesFilters', () => {
  it('lets everything through with no filters on', () => {
    for (const p of [museum, cafe, unknown]) expect(passesFilters(p, NO_FILTERS, at('03:00'))).toBe(true);
  });
  it('Open now keeps places open at that time and leaves out places without hours', () => {
    const f = { ...NO_FILTERS, openNow: true };
    expect([museum, cafe, unknown].filter(p => passesFilters(p, f, at('18:00'))).map(p => p.id)).toEqual([2]);
    expect([museum, cafe, unknown].filter(p => passesFilters(p, f, at('10:00'))).map(p => p.id)).toEqual([1, 2]);
  });
  it('Open now follows special hours', () => {
    const closure = [{ id: 'restoration', nameEn: 'Restoration', nameAr: 'ترميم', from: '2026-11-06', to: '2026-11-06', places: { '1': { closed: true as const } } }];
    expect(passesFilters(museum, { ...NO_FILTERS, openNow: true }, at('10:00'), closure)).toBe(false);
  });
  it('Step-free keeps only places marked step-free', () => {
    const f = { ...NO_FILTERS, stepFree: true };
    expect([museum, cafe, unknown].filter(p => passesFilters(p, f, at('10:00'))).map(p => p.id)).toEqual([1]);
  });
  it('both together', () => {
    expect(passesFilters(museum, { ...NO_FILTERS, openNow: true, stepFree: true }, at('18:00'))).toBe(false);
    expect(passesFilters(museum, { ...NO_FILTERS, openNow: true, stepFree: true }, at('12:00'))).toBe(true);
  });
  it('Era keeps places of that era, set or from their build year', () => {
    const f = { ...NO_FILTERS, era: 'mamluk' as const };
    const places = [{ id: 5, era: 'mamluk' as const }, { id: 6, builtFrom: 1356 }, { id: 7, builtFrom: 970 }, unknown];
    expect(places.filter(p => passesFilters(p, f, at('10:00'))).map(p => p.id)).toEqual([5, 6]);
  });
  it('knows when a filter is on', () => {
    expect(anyFilter(NO_FILTERS)).toBe(false);
    expect(anyFilter({ ...NO_FILTERS, era: 'fatimid' })).toBe(true);
  });
});

describe('withoutHours', () => {
  it('counts places with no hours', () => expect(withoutHours([museum, unknown, { id: 4 }])).toBe(2));
});
