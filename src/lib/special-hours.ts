// Special periods (Ramadan, Eid, one-off closures): date ranges in which some
// places keep different hours or are closed. They change the hours used
// everywhere hours are used (badge, week table, walk warnings, Plan my
// visit) on those dates only. Pure functions, shared by the app, the admin,
// the server's validation and the tests.

import { cairoTime, hoursProblems, isTime, openStatus, toMinutes, type OpenStatus, type OpeningHours, type TimeRange } from './opening-hours.js';
import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang } from '../i18n/lang.js';

export type PeriodEntry = { closed: true } | { days: TimeRange[][] };

export interface SpecialPeriod {
  /** Lowercase letters, numbers and dashes, e.g. "ramadan-2027". */
  id: string;
  nameEn: string;
  nameAr: string;
  nameFr?: string;
  nameEs?: string;
  /** First and last day, inclusive, as YYYY-MM-DD in Cairo. */
  from: string;
  to: string;
  /** By place ID: different weekly hours, or closed. Places not listed keep their usual hours. */
  places: Record<string, PeriodEntry>;
}

export const PERIOD_LIMITS = { periods: 30, name: 60, days: 62 };

// --- Cairo dates -------------------------------------------------------------

let dateFormat: Intl.DateTimeFormat | undefined;
/** The Cairo calendar date of an instant, as YYYY-MM-DD. */
export function cairoDate(at: Date): string {
  dateFormat ??= new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return dateFormat.format(at);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const toUtc = (date: string) => {
  const [, y, m, d] = DATE.exec(date)!.map(Number);
  return Date.UTC(y, m - 1, d);
};
export const isDate = (s: unknown): s is string => typeof s === 'string' && DATE.test(s) && new Date(toUtc(s)).toISOString().slice(0, 10) === s;
/** The date `n` days after `date`. */
export const addDays = (date: string, n: number) => new Date(toUtc(date) + n * 86_400_000).toISOString().slice(0, 10);
/** Day of the week, 0 = Sunday. */
export const weekday = (date: string) => new Date(toUtc(date)).getUTCDay();

// --- The hours in force ----------------------------------------------------------

/** The period (and its entry for the place) that applies on `date`, if any. The first listed wins. */
export function periodEntry(placeId: number, periods: SpecialPeriod[] | undefined, date: string) {
  for (const period of periods ?? []) {
    if (date < period.from || date > period.to) continue;
    const entry = period.places[String(placeId)];
    if (entry) return { period, entry };
  }
  return null;
}

/** A day's opening ranges: its period's where one lists the place, else the usual ones; null when unknown. */
function dayRanges(place: { id: number; hours?: OpeningHours }, date: string, periods: SpecialPeriod[] | undefined): TimeRange[] | null {
  const found = periodEntry(place.id, periods, date);
  const wd = weekday(date);
  if (found) return 'closed' in found.entry ? [] : found.entry.days[wd];
  return place.hours ? place.hours.days[wd] : null;
}

const DAY = 24 * 60;

/**
 * Whether the place is open at `at`, and when that changes, from the real
 * dates around it: each day takes its period's hours where one lists the
 * place, else the usual ones, and a range past midnight is carried from the
 * actual day before. Days with neither are unknown, never closed. Null when
 * nothing is known about now.
 */
export function openStatusAt(place: { id: number; hours?: OpeningHours }, at: Date, periods: SpecialPeriod[] | undefined): OpenStatus | null {
  if (!periods?.length) return openStatus(place.hours, at);
  const today = cairoDate(at);
  const dates = Array.from({ length: 9 }, (_, i) => addDays(today, i - 1)); // yesterday … a week ahead
  if (dates.every(d => !periodEntry(place.id, periods, d))) return openStatus(place.hours, at);

  const now = cairoTime(at).minutes; // minutes from today's midnight
  const known = dates.map(d => dayRanges(place, d, periods));
  const spans: [number, number][] = [];
  known.forEach((ranges, i) => {
    const base = (i - 1) * DAY;
    for (const r of ranges ?? []) {
      const s = base + toMinutes(r.open);
      let e = base + toMinutes(r.close);
      if (e <= s) e += DAY;
      spans.push([s, e]);
    }
  });
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const when = (t: number) => ({ inDays: Math.floor(t / DAY), minutes: ((t % DAY) + DAY) % DAY });
  const end = 8 * DAY; // the window's end
  const open = merged.find(([s, e]) => s <= now && now < e);
  if (open) return { open: true, closes: open[1] >= end ? null : when(open[1]) };
  if (known[1] === null) return null; // today unknown, and nothing carried over from yesterday
  const next = merged.find(([s]) => s > now);
  return { open: false, opens: next ? when(next[0]) : null };
}

export interface EffectiveHours {
  /** The week from today as weekly hours, with special days in place of usual ones (for the week table). */
  hours?: OpeningHours;
  /** The period whose hours apply to this place today. */
  period?: SpecialPeriod;
  /** Today is a special closure for this place. */
  closedToday: boolean;
  /** A period is on today but doesn't list this place: its usual hours may still differ. */
  mayDiffer?: SpecialPeriod;
}

/**
 * The place's hours as they stand at `at`. The seven days from `at`'s Cairo
 * date each take their period's hours where one lists the place, else the
 * usual ones, so a week table and "opens tomorrow" stay right across a
 * period's first and last days. (A range running past midnight from the day
 * before a period starts or ends uses that later day's hours.)
 */
export function effectiveHours(
  place: { id: number; hours?: OpeningHours },
  at: Date,
  periods: SpecialPeriod[] | undefined,
): EffectiveHours {
  if (!periods?.length) return { hours: place.hours, closedToday: false };
  const today = cairoDate(at);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const entries = week.map(date => periodEntry(place.id, periods, date));
  const todayEntry = entries[0];
  const activeToday = periods.find(p => today >= p.from && today <= p.to);
  const mayDiffer = !todayEntry && place.hours && activeToday ? activeToday : undefined;
  if (entries.every(e => !e)) return { hours: place.hours, closedToday: false, mayDiffer };
  const period = todayEntry?.period;
  const closedToday = !!todayEntry && 'closed' in todayEntry.entry;
  // Without usual hours the week isn't known outside the period: no week table.
  if (!place.hours) return { period, closedToday };

  const days: TimeRange[][] = Array.from({ length: 7 }, () => []);
  week.forEach((date, i) => {
    const wd = weekday(date);
    const e = entries[i]?.entry;
    days[wd] = (e ? ('closed' in e ? [] : e.days[wd]) : place.hours!.days[wd]).map(r => ({ ...r }));
  });
  const notes = Object.fromEntries(Object.entries(place.hours).filter(([k]) => k.startsWith('note')));
  return { hours: { ...notes, days }, period, closedToday, mayDiffer };
}

/** The periods without a place (when it's deleted); periods left with no places go too. */
export function withoutPlace(periods: SpecialPeriod[] | undefined, placeId: number): SpecialPeriod[] | undefined {
  if (!periods) return periods;
  return periods
    .map(p => {
      const { [String(placeId)]: _gone, ...places } = p.places;
      return { ...p, places };
    })
    .filter(p => Object.keys(p.places).length > 0);
}

// --- Words -----------------------------------------------------------------------

/** The period's name in `lang` (French and Spanish fall back to English), and its language. */
export function periodName(period: SpecialPeriod, lang: Lang): { text: string; lang: Lang } {
  const own = (period[`name${LANGUAGES[lang].suffix}` as 'nameEn'] ?? '').trim();
  return own ? { text: own, lang } : { text: period.nameEn, lang: 'en' };
}

// --- Content: normalising and checking -------------------------------------------

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function normalizeEntry(raw: any): PeriodEntry | null {
  if (raw?.closed === true) return { closed: true };
  if (Array.isArray(raw?.days) && raw.days.length === 7) {
    return {
      days: raw.days.map((d: unknown) =>
        Array.isArray(d) ? d.map((r: any) => ({ open: str(r?.open), close: str(r?.close) })).filter(r => r.open || r.close) : [],
      ),
    };
  }
  return null;
}

/** Periods from untrusted input, keeping only known fields. Undefined when it isn't a list. */
export function normalizePeriods(input: unknown): SpecialPeriod[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.map((p: any): SpecialPeriod => {
    const places: Record<string, PeriodEntry> = {};
    for (const [id, raw] of Object.entries(p?.places && typeof p.places === 'object' ? p.places : {})) {
      const entry = normalizeEntry(raw);
      if (/^\d+$/.test(id) && entry) places[id] = entry;
    }
    const optional = Object.fromEntries(OPTIONAL_LANGS.map(l => `name${LANGUAGES[l].suffix}`).filter(k => str(p?.[k])).map(k => [k, str(p?.[k])]));
    return { id: str(p?.id), nameEn: str(p?.nameEn), nameAr: str(p?.nameAr), ...optional, from: str(p?.from), to: str(p?.to), places };
  });
}

/** Problems with the periods, for the admin's save check. Empty when valid. */
export function periodProblems(periods: SpecialPeriod[], placeIds: Set<number>): string[] {
  const problems: string[] = [];
  const L = PERIOD_LIMITS;
  if (periods.length > L.periods) problems.push(`Special hours: at most ${L.periods} periods.`);
  const ids = new Set<string>();
  for (const p of periods) {
    const label = `Special hours "${p.nameEn || p.id || '(unnamed)'}"`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) problems.push(`${label}: ID must be lowercase letters, numbers and dashes.`);
    else if (ids.has(p.id)) problems.push(`${label}: ID "${p.id}" is used twice.`);
    ids.add(p.id);
    if (!p.nameEn) problems.push(`${label}: English name is empty.`);
    if (!/[؀-ۿ]/.test(p.nameAr)) problems.push(`${label}: Arabic name is missing.`);
    for (const lang of LANGS) {
      const v = p[`name${LANGUAGES[lang].suffix}` as 'nameEn'] ?? '';
      if (v.length > L.name) problems.push(`${label}: name${LANGUAGES[lang].suffix} is longer than ${L.name} characters.`);
    }
    if (!isDate(p.from) || !isDate(p.to)) problems.push(`${label}: dates must be real days, as YYYY-MM-DD.`);
    else if (p.from > p.to) problems.push(`${label}: the first day is after the last.`);
    else if ((toUtc(p.to) - toUtc(p.from)) / 86_400_000 + 1 > L.days) problems.push(`${label}: at most ${L.days} days.`);
    const entries = Object.entries(p.places);
    if (!entries.length) problems.push(`${label}: no places are changed.`);
    for (const [id, entry] of entries) {
      if (!placeIds.has(Number(id))) problems.push(`${label}: place ${id} doesn't exist.`);
      if ('days' in entry) {
        if (entry.days.some(d => d.some(r => !isTime(r.open) || !isTime(r.close))) || entry.days.length !== 7) {
          problems.push(`${label}: place ${id}: times must be HH:MM, e.g. 09:00.`);
        } else {
          problems.push(...hoursProblems({ days: entry.days }).map(x => `${label}: place ${id}: ${x}`));
        }
      }
    }
  }
  return problems;
}
