import { describe, expect, it } from 'vitest';
import { foldLine, icsDate, icsEvent, icsFileName, icsText } from './calendar';

const start = new Date('2026-11-12T07:30:00Z'); // 09:30 in Cairo
const end = new Date('2026-11-12T10:15:00Z');
const now = new Date('2026-11-11T01:00:00Z');
const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('icsDate', () => {
  it('writes UTC date-times', () => {
    expect(icsDate(start)).toBe('20261112T073000Z');
  });
});

describe('icsText', () => {
  it('escapes backslashes, semicolons, commas and line breaks', () => {
    expect(icsText('a\\b; c, d\ne\r\nf')).toBe('a\\\\b\\; c\\, d\\ne\\nf');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Walk')).toBe('SUMMARY:Walk');
  });

  it('keeps every line within 75 bytes and unfolds back to the original', () => {
    const line = `DESCRIPTION:${'شارع المعز لدين الله الفاطمي '.repeat(8)}🕌 end`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(bytes(part)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('never splits an emoji', () => {
    const folded = foldLine(`X:${'🕌'.repeat(40)}`);
    expect(folded).not.toMatch(/�/);
    expect(folded.replace(/\r\n /g, '')).toBe(`X:${'🕌'.repeat(40)}`);
  });
});

describe('icsEvent', () => {
  const ics = icsEvent({
    uid: 'plan-muizz-20261112T073000Z@cairo-walks',
    start,
    end,
    title: 'Al-Muizz Street, Route · Cairo Walks',
    location: 'Bab al-Futuh',
    geo: { lat: 30.0549, lng: 31.2638 },
    description: '09:30  1. Bab al-Futuh\n   ⚠ Closed when you get there',
    url: 'https://example.com/r/muizz?short=1',
    alarmMinutes: 60,
  }, now);
  const lines = ics.replace(/\r\n /g, '').split('\r\n');

  it('is a calendar with one event, CRLF line endings', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('BEGIN:VEVENT');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('has the times, text, place and link', () => {
    expect(lines).toContain('DTSTAMP:20261111T010000Z');
    expect(lines).toContain('DTSTART:20261112T073000Z');
    expect(lines).toContain('DTEND:20261112T101500Z');
    expect(lines).toContain('SUMMARY:Al-Muizz Street\\, Route · Cairo Walks');
    expect(lines).toContain('LOCATION:Bab al-Futuh');
    expect(lines).toContain('GEO:30.054900;31.263800');
    expect(lines).toContain('DESCRIPTION:09:30  1. Bab al-Futuh\\n   ⚠ Closed when you get there');
    expect(lines).toContain('URL:https://example.com/r/muizz?short=1');
  });

  it('adds a reminder before the start', () => {
    expect(lines).toContain('BEGIN:VALARM');
    expect(lines).toContain('TRIGGER:-PT60M');
  });

  it('leaves out what it was not given, and never ends before it starts', () => {
    const bare = icsEvent({ uid: 'x', start, end: start, title: 'Walk' }, now);
    expect(bare).not.toMatch(/LOCATION|GEO|DESCRIPTION|URL|VALARM/);
    expect(bare).toContain('DTEND:20261112T083000Z');
  });
});

describe('icsFileName', () => {
  it('makes a safe file name', () => {
    expect(icsFileName('Al-Muizz Street!')).toBe('cairo-walks-al-muizz-street.ics');
    expect(icsFileName('شارع')).toBe('cairo-walks-walk.ics');
  });
});
