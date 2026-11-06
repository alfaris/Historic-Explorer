import { describe, expect, it } from 'vitest';
import { cairoTime } from './opening-hours';
import { isActiveMosque, prayerOnArrival, prayersOn, prayerStatus, prayerText } from './prayer-times';

// Cairo is UTC+2 in winter. 2026-01-05 was a Monday; 2026-01-09 a Friday.
const cairo = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, m));
};
const minutes = (d: Date) => cairoTime(d).minutes;
const hm = (d: Date) => `${String(Math.floor(minutes(d) / 60)).padStart(2, '0')}:${String(minutes(d) % 60).padStart(2, '0')}`;

describe('prayersOn', () => {
  it('gives the five prayers in order, at sensible Cairo times in winter', () => {
    const p = prayersOn(cairo('2026-01-05', '10:00'));
    expect(p.map(x => x.name)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
    for (let i = 1; i < p.length; i++) expect(p[i].at.getTime()).toBeGreaterThan(p[i - 1].at.getTime());
    // Ranges around published Cairo times for early January.
    expect(minutes(p[0].at)).toBeGreaterThan(5 * 60);        // Fajr after 5:00
    expect(minutes(p[0].at)).toBeLessThan(5 * 60 + 40);
    expect(minutes(p[1].at)).toBeGreaterThan(11 * 60 + 50);  // Dhuhr around noon
    expect(minutes(p[1].at)).toBeLessThan(12 * 60 + 10);
    expect(minutes(p[3].at)).toBeGreaterThan(17 * 60);       // Maghrib around 17:10
    expect(minutes(p[3].at)).toBeLessThan(17 * 60 + 25);
  });
  it('shifts with Egyptian summer time (UTC+3): Dhuhr just before 13:00 in July', () => {
    const july = prayersOn(new Date(Date.UTC(2026, 6, 6, 7, 0)));
    expect(hm(july[1].at) >= '12:50' && hm(july[1].at) <= '13:05').toBe(true);
  });
  it('calls Friday’s midday prayer jumuah', () => {
    expect(prayersOn(cairo('2026-01-09', '10:00'))[1].name).toBe('jumuah');
  });
  it('uses the Cairo date, not UTC, just after midnight', () => {
    // 00:30 Cairo on Tuesday 6 Jan is still Monday 5 Jan in UTC.
    const tue = prayersOn(cairo('2026-01-06', '00:30'));
    expect(cairoTime(tue[1].at).day).toBe(2);
  });
});

describe('prayerStatus', () => {
  const monday = prayersOn(cairo('2026-01-05', '10:00'));
  const dhuhr = monday[1].at;
  const plus = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

  it('is "soon" within 90 minutes before a prayer', () => {
    expect(prayerStatus(plus(dhuhr, -60))).toEqual({ state: 'soon', name: 'dhuhr', at: dhuhr });
    expect(prayerStatus(plus(dhuhr, -120))).toBeNull();
  });
  it('is "now" from 5 minutes before to 30 minutes after', () => {
    expect(prayerStatus(plus(dhuhr, -4))).toEqual({ state: 'now', name: 'dhuhr', until: plus(dhuhr, 30) });
    expect(prayerStatus(plus(dhuhr, 29))!.state).toBe('now');
    expect(prayerStatus(plus(dhuhr, 31))?.state).not.toBe('now');
  });
  it('pauses for an hour on Friday', () => {
    const jumuah = prayersOn(cairo('2026-01-09', '10:00'))[1].at;
    expect(prayerStatus(plus(jumuah, 50))).toEqual({ state: 'now', name: 'jumuah', until: plus(jumuah, 60) });
  });
  it('warns about arriving during prayer', () => {
    expect(prayerOnArrival(65, plus(dhuhr, -60))).toBe(true);
    expect(prayerOnArrival(10, plus(dhuhr, -60))).toBe(false);
  });
});

describe('isActiveMosque', () => {
  it('goes by the name unless the admin set it', () => {
    expect(isActiveMosque({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر' })).toBe(true);
    expect(isActiveMosque({ nameEn: 'Al-Rifa’i', nameAr: 'مسجد الرفاعي' })).toBe(true);
    expect(isActiveMosque({ nameEn: 'Sakna Basha House', nameAr: 'منزل' })).toBe(false);
    expect(isActiveMosque({ nameEn: 'Al-Azhar Mosque', nameAr: 'الجامع الأزهر', mosque: false })).toBe(false);
    expect(isActiveMosque({ nameEn: 'Mausoleum', nameAr: 'ضريح', mosque: true })).toBe(true);
  });
});

describe('prayerText', () => {
  const dhuhr = prayersOn(cairo('2026-01-05', '10:00'))[1].at;
  const at = (m: number) => new Date(dhuhr.getTime() + m * 60_000);
  it('says when the next prayer is and how long visits pause', () => {
    const t = prayerText(prayerStatus(at(-60))!, 'en');
    expect(t.label).toMatch(/^Dhuhr at 1[12](:\d\d)? (am|pm)|^Dhuhr at noon/);
    expect(t.detail).toBe('visits pause for about 30 min');
    expect(prayerText(prayerStatus(at(-60))!, 'es').label).toMatch(/^Dhuhr a las 1[12]:\d\d$/);
    expect(prayerText(prayerStatus(at(-60))!, 'ar').label).toMatch(/^الظهر /);
  });
  it('says when visits resume during prayer', () => {
    const t = prayerText(prayerStatus(at(10))!, 'en');
    expect(t.label).toBe('Prayer time now');
    expect(t.detail).toMatch(/^visits resume around /);
    expect(prayerText(prayerStatus(at(10))!, 'fr').detail).toMatch(/^visites reprises vers 12 h/);
  });
});
