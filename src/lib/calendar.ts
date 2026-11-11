/**
 * A single calendar event as an iCalendar (.ics) file, built on the device so
 * it works offline. Phone and desktop calendars open it to add the event.
 */
export interface CalendarEvent {
  /** Stable per event, so saving the same plan twice updates rather than duplicates. */
  uid: string;
  start: Date;
  end: Date;
  title: string;
  location?: string;
  geo?: { lat: number; lng: number };
  description?: string;
  url?: string;
  /** Minutes before the start for a reminder; none when left out. */
  alarmMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC date-time in iCalendar form, e.g. 20261111T073000Z. */
export const icsDate = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escapes text values: backslash, semicolon, comma and line breaks. */
export const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

const encoder = new TextEncoder();

/**
 * Folds a content line so no line is longer than 75 bytes, continuing with a
 * space. Splits only between characters, never inside a UTF-8 sequence
 * (Arabic letters are two bytes) or an emoji's surrogate pair.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // Continuation lines start with a space, which counts toward their 75.
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function icsEvent(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cairo Walks//Plan my visit//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(event.uid)}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end > event.start ? event.end : new Date(event.start.getTime() + 60 * 60_000))}`,
    `SUMMARY:${icsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${icsText(event.location)}`);
  if (event.geo) lines.push(`GEO:${event.geo.lat.toFixed(6)};${event.geo.lng.toFixed(6)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.alarmMinutes !== undefined && event.alarmMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(event.title)}`,
      `TRIGGER:-PT${Math.round(event.alarmMinutes)}M`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** A file name safe on every system, e.g. "cairo-walks-al-muizz.ics". */
export const icsFileName = (slug: string) =>
  `cairo-walks-${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'walk'}.ics`;

/** Saves the event as a file; calendars offer to add it when it's opened. */
export function downloadIcs(event: CalendarEvent, slug: string) {
  const blob = new Blob([icsEvent(event)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = icsFileName(slug);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
