import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, type Content } from '../data/content';
import { backupDiff, backupFile, csvCell, describeChange, parseBackup, placesCsv } from './backup';

const now = new Date('2026-11-07T10:00:00Z');
const content = (): Content => normalizeContent(structuredClone(bundledContent));

/** Splits CSV text into rows of cells (quoted cells only, as placesCsv writes). */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      let cell = '';
      i++;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
        else if (text[i] === '"') { i++; break; }
        else cell += text[i++];
      }
      row.push(cell);
    }
    if (text[i] === ',') i++;
    else if (text.startsWith('\r\n', i)) { rows.push(row); row = []; i += 2; }
    else if (i < text.length && text[i] !== '"') throw new Error(`Unexpected ${JSON.stringify(text[i])} at ${i}`);
  }
  return rows;
}

describe('JSON backup', () => {
  it('gives back the same content after a round trip', () => {
    const c = { ...content(), maxPlaceId: 999, specialPeriods: [] };
    const file = backupFile(c, now);
    expect(file.name).toBe('cairo-walks-backup-2026-11-07.json');
    const parsed = parseBackup(file.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.savedAt).toBe(now.toISOString());
    expect(parsed.content).toEqual(normalizeContent(c));
    expect(backupDiff(c, parsed.content).same).toBe(true);
  });

  it('accepts bare content and a byte-order mark', () => {
    const parsed = parseBackup(`﻿${JSON.stringify(content())}`);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.savedAt).toBeNull();
  });

  it("refuses files that aren't backups", () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, problems: [] });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, problems: [] });
    expect(parseBackup('null')).toMatchObject({ ok: false });
  });

  it('checks the content like a save', () => {
    const c = content();
    c.places[0].routeId = 'nowhere';
    const parsed = parseBackup(backupFile(c, now).text);
    expect(parsed.ok).toBe(false);
    if ('problems' in parsed) expect(parsed.problems.join(' ')).toContain('route "nowhere" doesn\'t exist');
  });

  it('drops unknown fields', () => {
    const c = content() as Content & { extra?: string };
    (c.places[0] as unknown as Record<string, unknown>).evil = '<script>';
    const parsed = parseBackup(backupFile(c, now).text);
    expect(parsed.ok && 'evil' in parsed.content.places[0]).toBe(false);
  });
});

describe('backupDiff', () => {
  it('counts added, removed and changed places and routes', () => {
    const current = content();
    const next = content();
    next.places = next.places.slice(1); // one removed
    next.places[0] = { ...next.places[0], nameEn: 'Renamed' }; // one changed
    next.places.push({ ...next.places[1], id: 900_000 }); // one added
    const d = backupDiff(current, next);
    expect(d.places).toEqual({ added: 1, removed: 1, changed: 1, total: current.places.length });
    expect(d.routes).toMatchObject({ added: 0, removed: 0, changed: 0 });
    expect(d.same).toBe(false);
    expect(describeChange('Places', d.places)).toBe(`Places: ${current.places.length} (1 added, 1 removed, 1 changed)`);
    expect(describeChange('Routes', d.routes)).toBe(`Routes: ${current.routes.length}, no change`);
  });

  it('treats an unsaved glossary as the built-in one', () => {
    const current = content();
    const next = { ...content(), glossary: [] };
    expect(backupDiff(current, current).glossary.changed).toBe(0);
    expect(backupDiff(current, next).glossary.removed).toBeGreaterThan(0);
  });
});

describe('places CSV', () => {
  it('has a header and a row for each place, with Arabic intact', () => {
    const c = content();
    const file = placesCsv(c, now);
    expect(file.name).toBe('cairo-walks-places-2026-11-07.csv');
    expect(file.text.startsWith('﻿')).toBe(true);
    const rows = readCsv(file.text.slice(1));
    expect(rows[0]).toEqual([
      'ID', 'Route ID', 'Route', 'Category',
      'Name (English)', 'Name (Arabic)', 'Name (French)', 'Name (Spanish)',
      'Description (English)', 'Description (Arabic)', 'Description (French)', 'Description (Spanish)',
      'Latitude', 'Longitude', 'Opening hours set', 'Photo credit',
    ]);
    expect(rows).toHaveLength(c.places.length + 1);
    const p = c.places[0];
    const row = rows[1];
    expect(row[0]).toBe(String(p.id));
    expect(row[5]).toBe(p.nameAr);
    expect(row[9]).toBe(p.descriptionAr);
    expect(Number(row[12])).toBe(p.lat);
    expect(['Yes', 'No']).toContain(row[14]);
  });

  it('keeps commas, quotes and new lines inside a cell', () => {
    const c = content();
    c.places[0].descriptionEn = 'A "fine" gate,\nwith two lines';
    const rows = readCsv(placesCsv(c, now).text.slice(1));
    expect(rows[1][8]).toBe('A "fine" gate,\nwith two lines');
    expect(rows.every(r => r.length === rows[0].length)).toBe(true);
  });

  it("stops spreadsheets reading text as a formula", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5 dB')).toBe(`"'-5 dB"`);
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(undefined)).toBe('""');
  });
});
