// Prayer times in Cairo, and whether a visit to a mosque would fall during
// one. Times are worked out on the phone (adhan, Egyptian General Authority
// of Survey method), so this works offline. Pure apart from the clock passed in.

import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import type { Location } from '../data/locations.js';
import { cairoTime, formatTime } from './opening-hours.js';
import type { Lang } from '../i18n/lang.js';

/** Where Cairo's prayer times are computed for (also in the apps' vectors, contracts/vectors). */
export const PRAYER_PLACE = { lat: 30.0444, lng: 31.2357 };
const CAIRO = new Coordinates(PRAYER_PLACE.lat, PRAYER_PLACE.lng);

export type PrayerName = 'fajr' | 'dhuhr' | 'jumuah' | 'asr' | 'maghrib' | 'isha';

/** About how long tourist visits pause, in minutes. Estimates, and worded as such. */
export const PAUSE_MINUTES: Record<PrayerName, number> = { fajr: 30, dhuhr: 30, jumuah: 60, asr: 30, maghrib: 30, isha: 30 };
/** A pause starts a little before the call to prayer. */
const LEAD_MINUTES = 5;
/** How far ahead "Dhuhr at 11:42" is worth showing. */
const SOON_MINUTES = 90;

// The Cairo calendar date of an instant, as a local Date adhan reads Y/M/D from.
function cairoDay(at: Date, addDays = 0): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  return new Date(get('year'), get('month') - 1, get('day') + addDays, 12);
}

export type Prayer = { name: PrayerName; at: Date };

/** The day's five prayers in Cairo (Friday's midday prayer as jumuah), in order. */
export function prayersOn(at: Date, addDays = 0): Prayer[] {
  const day = cairoDay(at, addDays);
  const t = new PrayerTimes(CAIRO, day, CalculationMethod.Egyptian());
  const friday = day.getDay() === 5;
  return [
    { name: 'fajr', at: t.fajr },
    { name: friday ? 'jumuah' : 'dhuhr', at: t.dhuhr },
    { name: 'asr', at: t.asr },
    { name: 'maghrib', at: t.maghrib },
    { name: 'isha', at: t.isha },
  ];
}

export type PrayerStatus =
  | { state: 'now'; name: PrayerName; until: Date }
  | { state: 'soon'; name: PrayerName; at: Date };

const MIN = 60_000;

export type PrayerPause = Prayer & { start: Date; end: Date };

/** The prayers from the day before `at` to the day after, each with the visiting pause around it. */
export function pausesAround(at: Date): PrayerPause[] {
  return [...prayersOn(at, -1), ...prayersOn(at), ...prayersOn(at, 1)].map(p => ({
    ...p,
    start: new Date(p.at.getTime() - LEAD_MINUTES * MIN),
    end: new Date(p.at.getTime() + PAUSE_MINUTES[p.name] * MIN),
  }));
}

/** Whether visits are paused for prayer at `at` (and until when), or a prayer is coming up soon. */
export function prayerStatus(at: Date): PrayerStatus | null {
  const prayers = pausesAround(at);
  const now = at.getTime();
  const pause = prayers.find(p => now >= p.start.getTime() && now < p.end.getTime());
  if (pause) return { state: 'now', name: pause.name, until: pause.end };
  const next = prayers.find(p => p.start.getTime() > now);
  if (next && next.at.getTime() - now <= SOON_MINUTES * MIN) return { state: 'soon', name: next.name, at: next.at };
  return null;
}

/** True when a visitor arriving `minutesAway` from now would reach a mosque during prayer. */
export const prayerOnArrival = (minutesAway: number, now: Date) => prayerStatus(new Date(now.getTime() + minutesAway * MIN))?.state === 'now';

/** Whether visits to a place pause for prayer: the admin's setting, else a mosque by its name. */
export const isActiveMosque = (place: Pick<Location, 'nameEn' | 'nameAr' | 'mosque'>) =>
  place.mosque ?? (/\b(mosque|masjid)\b/i.test(place.nameEn) || /جامع|مسجد/.test(place.nameAr));

// --- Words -----------------------------------------------------------------

const NAMES: Record<Lang, Record<PrayerName, string>> = {
  en: { fajr: 'Fajr', dhuhr: 'Dhuhr', jumuah: 'Friday prayer', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  ar: { fajr: 'الفجر', dhuhr: 'الظهر', jumuah: 'صلاة الجمعة', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  fr: { fajr: 'Fajr', dhuhr: 'Dhuhr', jumuah: 'Prière du vendredi', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
  es: { fajr: 'Fajr', dhuhr: 'Dhuhr', jumuah: 'Oración del viernes', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
};

const clock = (d: Date, lang: Lang) => formatTime(cairoTime(d).minutes, lang);

/** "Dhuhr at 11:42 · visits pause for about 30 min" / "Prayer time now · visits resume around 12:15". */
export function prayerText(status: PrayerStatus, lang: Lang): { label: string; detail: string } {
  const name = NAMES[lang][status.name];
  if (status.state === 'now') {
    const until = clock(status.until, lang);
    return {
      label: lang === 'ar' ? `وقت ${status.name === 'jumuah' ? 'صلاة الجمعة' : 'الصلاة'} الآن` : lang === 'fr' ? 'Heure de la prière' : lang === 'es' ? 'Hora de la oración' : 'Prayer time now',
      detail: lang === 'ar' ? `تُستأنف الزيارات نحو ${until}` : lang === 'fr' ? `visites reprises vers ${until}` : lang === 'es' ? `las visitas se reanudan hacia ${until.startsWith('1:') ? 'la' : 'las'} ${until}` : `visits resume around ${until}`,
    };
  }
  const at = clock(status.at, lang);
  const mins = PAUSE_MINUTES[status.name];
  return {
    label: lang === 'ar' ? `${name} ${at}` : lang === 'fr' ? `${name} à ${at}` : lang === 'es' ? `${name} a ${at.startsWith('1:') ? 'la' : 'las'} ${at}` : `${name} at ${at}`,
    detail: lang === 'ar' ? `تتوقف الزيارات نحو ${mins} دقيقة` : lang === 'fr' ? `visites suspendues environ ${mins} min` : lang === 'es' ? `las visitas se pausan unos ${mins} min` : `visits pause for about ${mins} min`,
  };
}

// --- Best light for photos ---------------------------------------------------

/** About how long the golden hour lasts after sunrise and before sunset, in minutes. */
export const GOLDEN_MINUTES = 60;

export type Span = { start: Date; end: Date };
export type GoldenHours = { morning: Span; evening: Span; tomorrow: boolean };

/**
 * Cairo's golden hours, from the same sun times as the prayers (so offline):
 * the hour after sunrise and the hour before sunset. Today's, or tomorrow's
 * once today's evening light is over.
 */
export function goldenHours(at: Date): GoldenHours {
  const today = goldenOn(at);
  return today.evening.end > at ? { ...today, tomorrow: false } : { ...goldenOn(at, 1), tomorrow: true };
}

/** The golden hours of the Cairo day `at` falls on (or `addDays` after it). */
export function goldenOn(at: Date, addDays = 0): { morning: Span; evening: Span } {
  const t = new PrayerTimes(CAIRO, cairoDay(at, addDays), CalculationMethod.Egyptian());
  return {
    morning: { start: t.sunrise, end: new Date(t.sunrise.getTime() + GOLDEN_MINUTES * MIN) },
    evening: { start: new Date(t.sunset.getTime() - GOLDEN_MINUTES * MIN), end: t.sunset },
  };
}

/** Whether a visit from `arrive` to `leave` overlaps a golden hour of its day (touching an edge doesn't count). */
export function inBestLight(arrive: Date, leave: Date): boolean {
  const { morning, evening } = goldenOn(arrive);
  return [morning, evening].some(w => arrive < w.end && leave > w.start);
}

/** "Best light today: 6:12–7:12 am and 3:58–4:58 pm" in the visitor's language. */
export function goldenText(g: GoldenHours, lang: Lang): string {
  const span = (s: Span) => `${clock(s.start, lang)}–${clock(s.end, lang)}`;
  const [m, e] = [span(g.morning), span(g.evening)];
  if (lang === 'ar') return `${g.tomorrow ? 'أفضل إضاءة غداً' : 'أفضل إضاءة اليوم'}: ${m} و${e}`;
  if (lang === 'fr') return `${g.tomorrow ? 'Meilleure lumière demain' : 'Meilleure lumière aujourd’hui'} : ${m} et ${e}`;
  if (lang === 'es') return `${g.tomorrow ? 'Mejor luz mañana' : 'Mejor luz hoy'}: ${m} y ${e}`;
  return `${g.tomorrow ? 'Best light tomorrow' : 'Best light today'}: ${m} and ${e}`;
}
