import { describe, expect, it } from 'vitest';
import {
  cairoTime,
  closedOnArrival,
  dayName,
  formatTime,
  hoursProblems,
  normalizeHours,
  openStatus,
  statusText,
  weekRows,
  type OpeningHours,
} from './opening-hours';

// Cairo is UTC+2 (UTC+3 in summer time). These dates are in winter: Cairo = UTC+2.
// 2026-01-04 was a Sunday.
const cairo = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 0, 4 + day, h - 2, m));
};
const r = (open: string, close: string) => ({ open, close });
const everyDay = (...ranges: { open: string; close: string }[]): OpeningHours => ({ days: Array.from({ length: 7 }, () => ranges) });

describe('cairoTime', () => {
  it('converts to Cairo day and minutes, across the date line', () => {
    expect(cairoTime(cairo(0, '09:30'))).toEqual({ day: 0, minutes: 570 });
    // 23:30 UTC on Saturday is 01:30 on Sunday in Cairo.
    expect(cairoTime(new Date(Date.UTC(2026, 0, 3, 23, 30)))).toEqual({ day: 0, minutes: 90 });
  });
  it('follows Egyptian summer time', () => {
    // 2026-07-05 is a Sunday; Cairo is UTC+3 in summer.
    expect(cairoTime(new Date(Date.UTC(2026, 6, 5, 6, 0)))).toEqual({ day: 0, minutes: 540 });
  });
});

describe('openStatus', () => {
  const nineToFive = everyDay(r('09:00', '17:00'));

  it('is null without hours', () => expect(openStatus(undefined, new Date())).toBeNull());

  it('knows open and closed, with the next change', () => {
    expect(openStatus(nineToFive, cairo(1, '10:00'))).toEqual({ open: true, closes: { inDays: 0, minutes: 17 * 60 } });
    expect(openStatus(nineToFive, cairo(1, '08:00'))).toEqual({ open: false, opens: { inDays: 0, minutes: 9 * 60 } });
    expect(openStatus(nineToFive, cairo(1, '18:00'))).toEqual({ open: false, opens: { inDays: 1, minutes: 9 * 60 } });
    expect(openStatus(nineToFive, cairo(1, '17:00')).open).toBe(false); // closing time itself is closed
  });

  it('skips closed days', () => {
    const closedFriday: OpeningHours = { days: nineToFive.days.map((d, i) => (i === 5 ? [] : d)) };
    expect(openStatus(closedFriday, cairo(4, '18:00'))).toEqual({ open: false, opens: { inDays: 2, minutes: 9 * 60 } });
  });

  it('handles ranges past midnight, including Saturday night into Sunday', () => {
    const late = everyDay(r('18:00', '02:00'));
    expect(openStatus(late, cairo(2, '01:00'))).toEqual({ open: true, closes: { inDays: 0, minutes: 120 } });
    expect(openStatus(late, cairo(2, '23:00'))).toEqual({ open: true, closes: { inDays: 1, minutes: 120 } });
    const saturdayOnly: OpeningHours = { days: [[], [], [], [], [], [], [r('20:00', '03:00')]] };
    expect(openStatus(saturdayOnly, cairo(0, '01:00')).open).toBe(true); // Sunday 1 am, from Saturday night
    expect(openStatus(saturdayOnly, cairo(0, '04:00'))).toEqual({ open: false, opens: { inDays: 6, minutes: 20 * 60 } });
  });

  it('handles split days (closed for prayers) and round-the-clock places', () => {
    const split = everyDay(r('09:00', '11:30'), r('13:30', '17:00'));
    expect(openStatus(split, cairo(5, '12:00'))).toEqual({ open: false, opens: { inDays: 0, minutes: 13 * 60 + 30 } });
    // Almost all day is not round the clock: it closes at 23:59.
    expect(openStatus(everyDay(r('00:00', '23:59')), cairo(3, '23:58'))).toEqual({ open: true, closes: { inDays: 0, minutes: 23 * 60 + 59 } });
    const allDay = everyDay(r('00:00', '12:00'), r('12:00', '00:00'));
    expect(openStatus(allDay, cairo(3, '03:00'))).toEqual({ open: true, closes: null });
  });

  it('is closed for good when every day is closed', () => {
    expect(openStatus({ days: Array.from({ length: 7 }, () => []) }, cairo(0, '10:00'))).toEqual({ open: false, opens: null });
  });
});

describe('closedOnArrival', () => {
  const hours = everyDay(r('09:00', '17:00'));
  it('warns only when the place will be closed by the time you get there', () => {
    expect(closedOnArrival(hours, 30, cairo(1, '16:00'))).toBe(false);
    expect(closedOnArrival(hours, 75, cairo(1, '16:00'))).toBe(true);
    expect(closedOnArrival(undefined, 75, cairo(1, '16:00'))).toBe(false);
  });
});

describe('words', () => {
  it('formats times', () => {
    expect(formatTime(9 * 60, 'en')).toBe('9 am');
    expect(formatTime(17 * 60 + 30, 'en')).toBe('5:30 pm');
    expect(formatTime(12 * 60, 'en')).toBe('noon');
    expect(formatTime(0, 'en')).toBe('midnight');
    expect(formatTime(17 * 60 + 30, 'fr')).toBe('17 h 30');
    expect(formatTime(9 * 60, 'fr')).toBe('9 h');
    expect(formatTime(17 * 60 + 30, 'ar')).toBe('5:30 م');
    expect(formatTime(9 * 60, 'ar')).toBe('9 ص');
  });

  it('names days', () => {
    expect(dayName(6, 'en')).toBe('Saturday');
    expect(dayName(6, 'fr')).toBe('samedi');
    expect(dayName(5, 'ar')).toBe('الجمعة');
  });

  it('writes the status line', () => {
    const hours = everyDay(r('09:00', '17:00'));
    const at = cairo(1, '10:00');
    expect(statusText(openStatus(hours, at)!, 'en', at)).toEqual({ label: 'Open now', detail: 'closes 5 pm', soon: false });
    expect(statusText(openStatus(hours, at)!, 'fr', at)).toEqual({ label: 'Ouvert', detail: 'ferme à 17 h', soon: false });
    expect(statusText(openStatus(hours, at)!, 'ar', at)).toEqual({ label: 'مفتوح الآن', detail: 'يغلق 5 م', soon: false });
    const late = cairo(1, '16:30');
    expect(statusText(openStatus(hours, late)!, 'en', late)).toMatchObject({ label: 'Closing soon', soon: true });
    const evening = cairo(1, '20:00');
    expect(statusText(openStatus(hours, evening)!, 'en', evening).detail).toBe('opens tomorrow 9 am');
    expect(statusText(openStatus(hours, evening)!, 'fr', evening).detail).toBe('ouvre demain à 9 h');
    const morning = cairo(1, '07:00');
    expect(statusText(openStatus(hours, morning)!, 'fr', morning).detail).toBe('ouvre à 9 h');
    const closedFriday: OpeningHours = { days: hours.days.map((d, i) => (i === 5 ? [] : d)) };
    const thursdayNight = cairo(4, '20:00');
    expect(statusText(openStatus(closedFriday, thursdayNight)!, 'en', thursdayNight).detail).toBe('opens Saturday 9 am');
  });

  it('lists the week, Saturday first in Arabic', () => {
    const hours: OpeningHours = { days: [[r('09:00', '17:00')], [], [], [], [], [r('13:30', '17:00')], []] };
    expect(weekRows(hours, 'en')[0]).toEqual({ day: 1, name: 'Monday', text: 'Closed' });
    expect(weekRows(hours, 'en')[6]).toEqual({ day: 0, name: 'Sunday', text: '9 am–5 pm' });
    expect(weekRows(hours, 'fr')[4]).toEqual({ day: 5, name: 'Vendredi', text: '13 h 30 – 17 h' });
    expect(weekRows(hours, 'ar')[0].day).toBe(6);
  });
});

describe('validation', () => {
  it('accepts good hours and reports bad ones', () => {
    expect(hoursProblems(everyDay(r('09:00', '17:00')))).toEqual([]);
    expect(hoursProblems(everyDay(r('18:00', '02:00')))).toEqual([]);
    expect(hoursProblems({ days: [[]] })).toEqual(['opening hours need all seven days.']);
    expect(hoursProblems(everyDay(r('9:00', '17:00'))).join()).toMatch(/HH:MM/);
    expect(hoursProblems(everyDay(r('09:00', '09:00'))).join()).toMatch(/same time/);
    expect(hoursProblems(everyDay(r('09:00', '13:00'), r('12:00', '17:00'))).join()).toMatch(/overlap/);
    expect(hoursProblems({ ...everyDay(), noteEn: 'x'.repeat(201) }).join()).toMatch(/noteEn/);
  });

  it('normalizes untrusted input', () => {
    expect(normalizeHours(null)).toBeUndefined();
    expect(normalizeHours({ days: [[]] })).toBeUndefined();
    const h = normalizeHours({ days: [[{ open: ' 09:00 ', close: '17:00', x: 1 }], 'bad', [], [], [], [], [{ open: '', close: '' }]], noteEn: ' Hi ', noteFr: '', evil: 1 });
    expect(h).toEqual({ days: [[{ open: '09:00', close: '17:00' }], [], [], [], [], [], []], noteEn: 'Hi' });
  });
});
