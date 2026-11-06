import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { openStatus, statusText, weekRows } from './opening-hours';
import { addDays, cairoDate, effectiveHours, isDate, normalizePeriods, periodName, periodProblems, weekday, type SpecialPeriod } from './special-hours';

// Cairo is UTC+2 in winter (and in March 2026). 2026-03-02 was a Monday.
const cairo = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, m));
};
const week = (open: string, close: string) => Array.from({ length: 7 }, () => [{ open, close }]);
const place = { id: 7, hours: { days: week('09:00', '17:00'), noteEn: 'Usual note' } };
const ramadan: SpecialPeriod = {
  id: 'ramadan-2026', nameEn: 'Ramadan', nameAr: 'رمضان', from: '2026-03-01', to: '2026-03-30',
  places: { '7': { days: week('10:00', '15:00') } },
};
const eid: SpecialPeriod = { id: 'eid', nameEn: 'Eid', nameAr: 'العيد', from: '2026-03-31', to: '2026-03-31', places: { '7': { closed: true } } };

describe('dates', () => {
  it('works in Cairo dates', () => {
    expect(cairoDate(cairo('2026-03-02', '00:30'))).toBe('2026-03-02'); // still 1 March in UTC
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(weekday('2026-03-02')).toBe(1);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-02-28')).toBe(true);
  });
});

describe('effectiveHours', () => {
  it('uses the usual hours with no periods, or outside them', () => {
    expect(effectiveHours(place, cairo('2026-03-02', '12:00'), undefined).hours).toBe(place.hours);
    expect(effectiveHours(place, cairo('2026-02-10', '12:00'), [ramadan]).hours).toBe(place.hours);
  });

  it('uses the period’s hours on its days only, and keeps the usual note', () => {
    const e = effectiveHours(place, cairo('2026-03-02', '16:00'), [ramadan]);
    expect(e.period?.id).toBe('ramadan-2026');
    expect(e.hours?.noteEn).toBe('Usual note');
    const status = openStatus(e.hours, cairo('2026-03-02', '16:00'))!;
    expect(statusText(status, 'en', cairo('2026-03-02', '16:00')).label).toBe('Closed'); // shorter Ramadan hours
    expect(openStatus(place.hours, cairo('2026-03-02', '16:00'))!.open).toBe(true); // usually open
  });

  it('switches back on the day after the period, in the week table too', () => {
    // 27 March (Friday): the week ahead runs into 31 March and 1 April.
    const e = effectiveHours(place, cairo('2026-03-27', '12:00'), [ramadan]);
    const rows = Object.fromEntries(weekRows(e.hours!, 'en').map(r => [r.name, r.text]));
    expect(rows.Friday).toBe('10 am–3 pm'); // 27 March, Ramadan
    expect(rows.Tuesday).toBe('9 am–5 pm'); // 31 March, after Ramadan
  });

  it('shows a one-day closure as closed today, opening the next day', () => {
    const at = cairo('2026-03-31', '11:00');
    const e = effectiveHours(place, at, [ramadan, eid]);
    expect(e.closedToday).toBe(true);
    expect(e.period?.id).toBe('eid');
    expect(statusText(openStatus(e.hours, at)!, 'en', at)).toMatchObject({ label: 'Closed', detail: 'opens tomorrow 9 am' });
  });

  it('notes that hours may differ for a place a running period doesn’t list', () => {
    const other = { id: 8, hours: place.hours };
    const e = effectiveHours(other, cairo('2026-03-02', '12:00'), [ramadan]);
    expect(e.mayDiffer?.id).toBe('ramadan-2026');
    expect(e.hours).toBe(place.hours);
  });
});

describe('periods in content', () => {
  it('names a period in the visitor’s language, falling back to English', () => {
    expect(periodName(ramadan, 'ar')).toEqual({ text: 'رمضان', lang: 'ar' });
    expect(periodName(ramadan, 'fr')).toEqual({ text: 'Ramadan', lang: 'en' });
  });

  it('normalizes untrusted input', () => {
    const [p] = normalizePeriods([{ ...ramadan, extra: 1, places: { '7': { closed: true, x: 1 }, abc: { closed: true }, '9': { nope: 1 } } }])!;
    expect(p).not.toHaveProperty('extra');
    expect(p.places).toEqual({ '7': { closed: true } });
    expect(normalizePeriods('x')).toBeUndefined();
    expect(normalizeContent(bundledContent).specialPeriods).toBeUndefined();
  });

  it('checks periods before saving', () => {
    const ids = new Set([7]);
    expect(periodProblems([ramadan, eid], ids)).toEqual([]);
    const bad = { ...ramadan, id: 'Bad', nameAr: '', from: '2026-03-30', to: '2026-03-01', places: { '99': { closed: true as const } } };
    const problems = periodProblems([bad], ids);
    expect(problems.some(p => p.includes('ID must be'))).toBe(true);
    expect(problems.some(p => p.includes('Arabic name'))).toBe(true);
    expect(problems.some(p => p.includes('first day is after'))).toBe(true);
    expect(problems.some(p => p.includes("place 99 doesn't exist"))).toBe(true);
    expect(periodProblems([{ ...ramadan, to: '2026-06-30' }], ids).some(p => p.includes('at most 62 days'))).toBe(true);
    const firstPlace = bundledContent.places[0].id;
    expect(validateContent({ ...bundledContent, specialPeriods: [{ ...eid, places: { [firstPlace]: { closed: true } } }] })).toEqual([]);
    expect(validateContent({ ...bundledContent, specialPeriods: [bad] }).length).toBeGreaterThan(0);
  });
});
