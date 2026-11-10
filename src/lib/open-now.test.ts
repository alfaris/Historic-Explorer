import { describe, expect, it } from 'vitest';
import { routeOpenNow } from './open-now';
import type { SpecialPeriod } from './special-hours';

// Cairo is UTC+2 in March 2026; 2026-03-02 was a Monday.
const cairo = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, m));
};
const week = (open: string, close: string) => ({ days: Array.from({ length: 7 }, () => [{ open, close }]) });

const stops = [
  { id: 1, hours: week('09:00', '17:00') },
  { id: 2, hours: week('09:00', '16:30') },
  { id: 3, hours: week('18:00', '23:00') },
  { id: 4 }, // no hours: not counted
];

describe('routeOpenNow', () => {
  it('counts open stops among those with hours, and those closing within the hour', () => {
    expect(routeOpenNow(stops, cairo('2026-03-02', '12:00'), undefined)).toEqual({ known: 3, open: 2, closingSoon: 0 });
    expect(routeOpenNow(stops, cairo('2026-03-02', '16:00'), undefined)).toEqual({ known: 3, open: 2, closingSoon: 2 });
    expect(routeOpenNow(stops, cairo('2026-03-02', '16:45'), undefined)).toEqual({ known: 3, open: 1, closingSoon: 1 });
    expect(routeOpenNow(stops, cairo('2026-03-02', '20:00'), undefined)).toEqual({ known: 3, open: 1, closingSoon: 0 });
  });

  it('nothing known without hours', () => {
    expect(routeOpenNow([{ id: 4 }], cairo('2026-03-02', '12:00'), undefined)).toEqual({ known: 0, open: 0, closingSoon: 0 });
  });

  it('uses special hours', () => {
    const closed: SpecialPeriod = { id: 'eid', nameEn: 'Eid', nameAr: 'العيد', from: '2026-03-02', to: '2026-03-02', places: { '1': { closed: true } } };
    expect(routeOpenNow(stops, cairo('2026-03-02', '12:00'), [closed])).toEqual({ known: 3, open: 1, closingSoon: 0 });
  });

  it('a place open round the clock is open and never closing soon', () => {
    expect(routeOpenNow([{ id: 9, hours: week('00:00', '00:00') }], cairo('2026-03-02', '23:30'), undefined).open).toBe(1);
  });
});
