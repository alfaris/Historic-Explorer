import { describe, expect, it } from 'vitest';
import { applyHours } from './bulk-hours';

const week = (open: string, close: string) => Array.from({ length: 7 }, () => [{ open, close }]);

describe('applyHours', () => {
  const places = [
    { id: 1 },
    { id: 2, hours: { days: week('08:00', '12:00'), noteEn: 'Closed for Friday prayers', noteAr: 'مغلق وقت صلاة الجمعة' } },
    { id: 3, hours: { days: week('10:00', '11:00') } },
  ];
  it('sets the days on the chosen places only', () => {
    const out = applyHours(places, new Set([1, 2]), { days: week('09:00', '17:00') });
    expect(out[0].hours?.days[0]).toEqual([{ open: '09:00', close: '17:00' }]);
    expect(out[1].hours?.days[3]).toEqual([{ open: '09:00', close: '17:00' }]);
    expect(out[2]).toBe(places[2]);
  });
  it('keeps each place’s notes unless new ones are given, language by language', () => {
    const kept = applyHours(places, new Set([2]), { days: week('09:00', '17:00') })[1].hours!;
    expect(kept.noteEn).toBe('Closed for Friday prayers');
    const replaced = applyHours(places, new Set([2]), { days: week('09:00', '17:00'), noteEn: 'Ticket office closes at 4:30 pm', noteAr: ' ' })[1].hours!;
    expect(replaced.noteEn).toBe('Ticket office closes at 4:30 pm');
    expect(replaced.noteAr).toBe('مغلق وقت صلاة الجمعة');
  });
  it('gives each place its own copy of the days', () => {
    const out = applyHours(places, new Set([1, 3]), { days: week('09:00', '17:00') });
    expect(out[0].hours!.days).not.toBe(out[2].hours!.days);
    expect(out[0].hours!.days[0]).not.toBe(out[2].hours!.days[0]);
  });
});
