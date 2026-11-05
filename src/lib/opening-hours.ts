// Opening hours: when a place is open, in Cairo time, and how to say it in
// each language. Pure functions, shared by the app, the admin, the server's
// validation and the tests. Times are "HH:MM" strings; a range whose close is
// at or before its open runs past midnight (e.g. 18:00–02:00).

export type FormatLang = 'en' | 'ar' | 'fr';

export interface TimeRange {
  open: string;
  close: string;
}

export interface OpeningHours {
  /** Seven entries, Sunday first (as Date.getDay()). An empty list means closed that day. */
  days: TimeRange[][];
  /** Optional note, e.g. "Closed for Friday prayers 11:30–13:30". French and Arabic fall back to English. */
  noteEn?: string;
  noteAr?: string;
  noteFr?: string;
}

const DAY = 24 * 60;
const WEEK = 7 * DAY;
export const CAIRO_TIME_ZONE = 'Africa/Cairo';
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isTime = (s: unknown): s is string => typeof s === 'string' && TIME.test(s);
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Day of week (0 = Sunday) and minutes since midnight, in Cairo. */
export function cairoTime(at: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

// Every opening as [start, end) in minutes from Sunday 00:00, merged where
// ranges touch (e.g. 18:00–24:00 then 00:00–02:00).
function intervals(hours: OpeningHours): [number, number][] {
  const list: [number, number][] = [];
  hours.days.forEach((ranges, day) => {
    for (const r of ranges) {
      const start = day * DAY + toMinutes(r.open);
      let end = day * DAY + toMinutes(r.close);
      if (end <= start) end += DAY;
      list.push([start, end]);
    }
  });
  list.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of list) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  // Open round the clock all week: one unbroken range at least a week long.
  if (merged.length === 1 && merged[0][1] - merged[0][0] >= WEEK) return [[0, Infinity]];
  return merged;
}

/** A moment in the coming week: how many days from today, and the time that day. */
export type When = { inDays: number; minutes: number };

export type OpenStatus =
  | { open: true; closes: When | null }
  | { open: false; opens: When | null };

/** Whether the place is open at `at`, and when that changes. Null when it has no hours. */
export function openStatus(hours: OpeningHours | undefined, at: Date): OpenStatus | null {
  if (!hours) return null;
  const list = intervals(hours);
  if (!list.length) return { open: false, opens: null };
  if (list[0][1] === Infinity) return { open: true, closes: null };
  const { day, minutes } = cairoTime(at);
  const now = day * DAY + minutes;
  const when = (t: number): When => {
    const ahead = t - now; // minutes from now
    const total = minutes + ahead;
    return { inDays: Math.floor(total / DAY), minutes: ((total % DAY) + DAY) % DAY };
  };
  // Check this week's ranges and, for ranges past Saturday midnight, last week's.
  for (const [s, e] of list) {
    for (const shift of [-WEEK, 0]) {
      if (now >= s + shift && now < e + shift) return { open: true, closes: when(e + shift) };
    }
  }
  const next = list.map(([s]) => (s > now ? s : s + WEEK)).sort((a, b) => a - b)[0];
  return { open: false, opens: when(next) };
}

export const isOpenAt = (hours: OpeningHours | undefined, at: Date) => openStatus(hours, at)?.open ?? null;

/**
 * True when the place has hours and will be closed `minutesAway` from now,
 * e.g. by the time a visitor walks there. Null-safe: no hours, no warning.
 */
export const closedOnArrival = (hours: OpeningHours | undefined, minutesAway: number, now: Date) =>
  isOpenAt(hours, new Date(now.getTime() + minutesAway * 60_000)) === false;

/** Problems with the hours, for the admin's save check. Empty when valid. */
export function hoursProblems(hours: OpeningHours): string[] {
  const problems: string[] = [];
  if (!Array.isArray(hours.days) || hours.days.length !== 7) return ['opening hours need all seven days.'];
  hours.days.forEach((ranges, day) => {
    const name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    if (ranges.length > 4) problems.push(`${name}: at most 4 time ranges.`);
    const spans: [number, number][] = [];
    for (const r of ranges) {
      if (!isTime(r.open) || !isTime(r.close)) {
        problems.push(`${name}: times must be HH:MM, e.g. 09:00.`);
        continue;
      }
      if (r.open === r.close) problems.push(`${name}: a time range can't open and close at the same time.`);
      const s = toMinutes(r.open);
      let e = toMinutes(r.close);
      if (e <= s) e += DAY;
      spans.push([s, e]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    if (spans.some((sp, i) => i > 0 && sp[0] < spans[i - 1][1])) problems.push(`${name}: time ranges overlap.`);
  });
  for (const [key, max] of [['noteEn', 200], ['noteAr', 200], ['noteFr', 200]] as const) {
    if ((hours[key] ?? '').length > max) problems.push(`opening hours ${key} is longer than ${max} characters.`);
  }
  return problems;
}

/** Hours from untrusted input, keeping only well-formed parts; undefined when there are none. */
export function normalizeHours(input: unknown): OpeningHours | undefined {
  const raw = input as { days?: unknown } | null;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.days) || raw.days.length !== 7) return undefined;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const days = raw.days.map(d =>
    Array.isArray(d)
      ? d.map((r: any) => ({ open: str(r?.open), close: str(r?.close) })).filter(r => r.open || r.close)
      : [],
  );
  const notes = raw as Record<string, unknown>;
  return {
    days,
    ...(str(notes.noteEn) ? { noteEn: str(notes.noteEn) } : {}),
    ...(str(notes.noteAr) ? { noteAr: str(notes.noteAr) } : {}),
    ...(str(notes.noteFr) ? { noteFr: str(notes.noteFr) } : {}),
  };
}

// --- Words -----------------------------------------------------------------

/** "9 am", "5:30 pm" · "9 h", "17 h 30" · "9 ص", "5:30 م". */
export function formatTime(minutes: number, lang: FormatLang): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const mm = String(min).padStart(2, '0');
  if (lang === 'fr') return min ? `${h} h ${mm}` : `${h} h`;
  if (m === 0) return lang === 'ar' ? 'منتصف الليل' : 'midnight';
  if (m === 12 * 60) return lang === 'ar' ? 'الظهر' : 'noon';
  const h12 = h % 12 || 12;
  const clock = min ? `${h12}:${mm}` : `${h12}`;
  if (lang === 'ar') return `${clock} ${h < 12 ? 'ص' : 'م'}`;
  return `${clock} ${h < 12 ? 'am' : 'pm'}`;
}

const LOCALE: Record<FormatLang, string> = { en: 'en-GB', ar: 'ar-EG', fr: 'fr-FR' };

/** Weekday name for 0 = Sunday … 6 = Saturday. */
export function dayName(day: number, lang: FormatLang): string {
  // 2023-01-01 was a Sunday.
  const date = new Date(Date.UTC(2023, 0, 1 + day, 12));
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', timeZone: 'UTC' }).format(date);
}

const whenText = (w: When, lang: FormatLang, today: number) => {
  const time = formatTime(w.minutes, lang);
  if (w.inDays === 0) return time;
  if (w.inDays === 1) return lang === 'ar' ? `غدًا ${time}` : lang === 'fr' ? `demain à ${time}` : `tomorrow ${time}`;
  const day = dayName((today + w.inDays) % 7, lang);
  return lang === 'ar' ? `${day} ${time}` : lang === 'fr' ? `${day} à ${time}` : `${day} ${time}`;
};

/** A short status line: "Open now · closes 5 pm", "Closed · opens tomorrow 9 am", … */
export function statusText(status: OpenStatus, lang: FormatLang, at: Date): { label: string; detail: string | null; soon: boolean } {
  const today = cairoTime(at).day;
  if (status.open) {
    const closes = status.closes;
    const soon = !!closes && closes.inDays === 0 && closes.minutes - cairoTime(at).minutes <= 60;
    const label = soon
      ? (lang === 'ar' ? 'يغلق قريبًا' : lang === 'fr' ? 'Ferme bientôt' : 'Closing soon')
      : (lang === 'ar' ? 'مفتوح الآن' : lang === 'fr' ? 'Ouvert' : 'Open now');
    const detail = !closes
      ? (lang === 'ar' ? 'على مدار الساعة' : lang === 'fr' ? '24 h/24' : 'Open 24 hours')
      : (lang === 'ar' ? `يغلق ${whenText(closes, lang, today)}` : lang === 'fr' ? `ferme ${closes.inDays === 0 ? 'à ' : ''}${whenText(closes, lang, today)}` : `closes ${whenText(closes, lang, today)}`);
    return { label, detail, soon };
  }
  const label = lang === 'ar' ? 'مغلق الآن' : lang === 'fr' ? 'Fermé' : 'Closed';
  const opens = (status as Extract<OpenStatus, { open: false }>).opens;
  const detail = !opens
    ? null
    : lang === 'ar' ? `يفتح ${whenText(opens, lang, today)}` : lang === 'fr' ? `ouvre ${opens.inDays === 0 ? 'à ' : ''}${whenText(opens, lang, today)}` : `opens ${whenText(opens, lang, today)}`;
  return { label, detail, soon: false };
}

/** The week as rows to display, starting Saturday in Arabic and Monday otherwise. */
export function weekRows(hours: OpeningHours, lang: FormatLang): { day: number; name: string; text: string }[] {
  const order = lang === 'ar' ? [6, 0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 0];
  const closed = lang === 'ar' ? 'مغلق' : lang === 'fr' ? 'Fermé' : 'Closed';
  const dash = lang === 'fr' ? ' – ' : '–';
  return order.map(day => ({
    day,
    name: dayName(day, lang).replace(/^./, c => c.toUpperCase()),
    text: hours.days[day].length
      ? hours.days[day].map(r => `${formatTime(toMinutes(r.open), lang)}${dash}${formatTime(toMinutes(r.close), lang)}`).join(lang === 'ar' ? '، ' : ', ')
      : closed,
  }));
}
