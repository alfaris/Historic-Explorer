import { describe, expect, it } from 'vitest';
import { importTranslations, missingRows, parseCsv, translationSheet } from './translation-sheet';
import { csvText } from './backup';
import { bundledContent, glossaryOf, normalizeContent, type Content } from '../data/content';

// With one glossary term not yet in French or Spanish (the built-in ones are).
const base = (): Content => {
  const c = normalizeContent(structuredClone(bundledContent));
  return { ...c, glossary: [...glossaryOf(c), { id: 'riwaq', termEn: 'Riwaq', termAr: 'رواق', defEn: 'A covered arcade.', defAr: 'رواق مسقوف.', match: ['riwaq'] }] };
};
// The export with a translation typed into the last column of the rows chosen.
const filledSheet = (content: Content, lang: 'fr' | 'es', fill: (row: string[]) => string) => {
  const [head, ...rows] = parseCsv(translationSheet(content, lang).text);
  return csvText([head, ...rows.map(r => [...r.slice(0, 5), fill(r)])]);
};

describe('missingRows', () => {
  it('lists every missing French text, with its English and Arabic', () => {
    const c = base();
    const rows = missingRows(c, 'fr');
    const p = c.places[0];
    expect(rows).toContainEqual({ kind: 'place', id: String(p.id), field: 'nameFr', english: p.nameEn, arabic: p.nameAr });
    expect(rows.some(r => r.kind === 'term')).toBe(true);
    // Routes in the bundle already have French names: they aren't listed.
    expect(rows.some(r => r.kind === 'route' && r.field === 'nameFr')).toBe(false);
  });

  it("lists a route's highlights as one cell, a line each", () => {
    const c = base();
    const { highlightsFr: _, ...r } = c.routes[0];
    c.routes[0] = r as Content['routes'][number];
    const row = missingRows(c, 'fr').find(x => x.kind === 'route' && x.field === 'highlightsFr')!;
    expect(row.english).toBe(c.routes[0].highlightsEn.join('\n'));
  });
});

describe('parseCsv', () => {
  it('reads back what csvText writes: quotes, commas, new lines, Arabic and formula guards', () => {
    const rows = [['a, "b"', 'line 1\nline 2', 'جامع', '=1+1', '-dash', '']];
    const parsed = parseCsv(csvText(rows));
    expect(parsed[0].slice(0, 3)).toEqual(['a, "b"', 'line 1\nline 2', 'جامع']);
    expect(parsed[0][3]).toBe("'=1+1");
  });
});

describe('importTranslations', () => {
  it('fills the empty fields from a filled-in sheet', () => {
    const c = base();
    const p = c.places[0];
    const term = glossaryOf(c).find(t => t.id === 'riwaq')!;
    const csv = filledSheet(c, 'fr', r =>
      r[0] === 'place' && r[1] === String(p.id) && r[2] === 'nameFr' ? 'Mosquée, "Ibn" Touloun'
      : r[0] === 'term' && r[1] === term.id && r[2] === 'defFr' ? 'Ligne 1\nLigne 2'
      : '');
    const res = importTranslations(c, csv);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res).toMatchObject({ lang: 'fr', filled: 2, alreadyFilled: 0, unknown: 0 });
    expect(res.content.places[0].nameFr).toBe('Mosquée, "Ibn" Touloun');
    expect(glossaryOf(res.content).find(t => t.id === term.id)!.defFr).toBe('Ligne 1\nLigne 2');
    expect(res.content.places[0].drafted).toBeUndefined();
  });

  it('never overwrites a field translated meanwhile, and counts rows it cannot place', () => {
    const c = base();
    const p = c.places[0];
    const csv = filledSheet(c, 'es', r => (r[1] === String(p.id) && r[2] === 'nameEs' ? 'Mezquita' : ''));
    const withUnknown = csv.replace(/\r\n$/, '') + '\r\n' + csvText([['place', '99999', 'nameEs', 'x', 'x', 'Nada']]).replace('﻿', '');
    const meanwhile = { ...c, places: c.places.map((x, i) => (i === 0 ? { ...x, nameEs: 'Ya traducido' } : x)) };
    const res = importTranslations(meanwhile, withUnknown);
    expect(res).toMatchObject({ ok: true, filled: 0, alreadyFilled: 1, unknown: 1 });
    if (res.ok) expect(res.content.places[0].nameEs).toBe('Ya traducido');
  });

  it('turns a route highlights cell back into a list', () => {
    const c = base();
    const { highlightsEs: _, ...r } = c.routes[0];
    c.routes[0] = r as Content['routes'][number];
    const csv = filledSheet(c, 'es', row => (row[2] === 'highlightsEs' ? 'Uno\nDos\n\nTres' : ''));
    const res = importTranslations(c, csv);
    expect(res.ok && res.content.routes[0].highlightsEs).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('refuses a file that is not a translation sheet', () => {
    expect(importTranslations(base(), 'name,email\na,b')).toMatchObject({ ok: false });
    expect(importTranslations(base(), '')).toMatchObject({ ok: false });
  });
});
