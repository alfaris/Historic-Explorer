// The translation spreadsheet: every text still missing in French or Spanish
// (places, routes, glossary terms, special-hours names) as a CSV for a human
// translator, and reading it back. Import fills only fields that are still
// empty, so it never overwrites a translation made meanwhile. Pure.

import { glossaryOf, type Content } from '../data/content';
import { LANGUAGES, OPTIONAL_LANGS, type OptionalLang } from '../i18n/lang';
import { missingText } from './content-health';
import { missingPlaceText } from './translations';
import { csvText, dated, CSV_TYPE } from './backup';

export type SheetKind = 'place' | 'route' | 'term' | 'period';
export type SheetRow = { kind: SheetKind; id: string; field: string; english: string; arabic: string };

const ROUTE_TEXT = ['name', 'description', 'metro', 'gettingThere'];
const TERM_TEXT = ['term', 'def'];
const PERIOD_TEXT = ['name'];
// Lists (a route's highlights) are one cell, a line each.
const LIST_FIELDS = new Set(['highlights']);

type Rec = Record<string, unknown>;
const text = (v: unknown) => (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '');
const arabicOf = (o: Rec, field: string, lang: OptionalLang) => text(o[field.slice(0, -LANGUAGES[lang].suffix.length) + 'Ar']);

/** Every text still missing in `lang`, item by item: places, routes, glossary terms, special hours. */
export function missingRows(content: Content, lang: OptionalLang): SheetRow[] {
  const rows: SheetRow[] = [];
  const add = (kind: SheetKind, id: string | number, o: object, missing: Record<string, string>) => {
    for (const [field, english] of Object.entries(missing)) rows.push({ kind, id: String(id), field, english, arabic: arabicOf(o as Rec, field, lang) });
  };
  for (const p of content.places) add('place', p.id, p, missingPlaceText(p, lang));
  for (const r of content.routes) {
    const missing = missingText(r, lang, ROUTE_TEXT);
    const key = `highlights${LANGUAGES[lang].suffix}`;
    const own = (r as unknown as Rec)[key];
    if (r.highlightsEn.length && !(Array.isArray(own) && own.length)) missing[key] = r.highlightsEn.join('\n');
    add('route', r.id, r, missing);
  }
  for (const t of glossaryOf(content)) add('term', t.id, t, missingText(t, lang, TERM_TEXT));
  for (const s of content.specialPeriods ?? []) add('period', s.id, s, missingText(s, lang, PERIOD_TEXT));
  return rows;
}

const header = (lang: OptionalLang) => ['Type', 'ID', 'Field', 'English', 'Arabic', `Translation (${LANGUAGES[lang].english})`];

/** The spreadsheet for `lang`: one row per missing text, with an empty Translation column. */
export function translationSheet(content: Content, lang: OptionalLang, now = new Date()) {
  const rows = missingRows(content, lang).map(r => [r.kind, r.id, r.field, r.english, r.arabic, '']);
  return { name: dated(`translate-${lang}`, 'csv', now), type: CSV_TYPE, text: csvText([header(lang), ...rows]) };
}

/** Rows of a CSV text: quoted cells, doubled quotes, new lines inside quotes, CRLF or LF, a leading byte-order mark. */
export function parseCsv(input: string): string[][] {
  const s = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

// csvCell guards cells a spreadsheet would read as a formula with an apostrophe; take it off again.
const unguard = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

export type ImportResult =
  | { ok: false; message: string }
  | { ok: true; lang: OptionalLang; content: Content; filled: number; alreadyFilled: number; unknown: number };

/**
 * Reads a filled-in spreadsheet back. Only empty fields that the export would
 * have listed are filled; a field translated meanwhile is left alone, and rows
 * for items or fields that don't exist (any more) are counted as unknown.
 */
export function importTranslations(content: Content, csv: string): ImportResult {
  const rows = parseCsv(csv);
  const head = rows[0]?.map(c => c.trim()) ?? [];
  const lang = OPTIONAL_LANGS.find(l => head[5] === header(l)[5]);
  if (!lang || header(lang).slice(0, 5).some((h, i) => head[i] !== h)) {
    return { ok: false, message: "This isn't a translation spreadsheet from Cairo Walks (its first row should be Type, ID, Field, English, Arabic, Translation (French or Spanish))." };
  }
  // What can be filled now: the export's rows, keyed by item and field.
  const open = new Set(missingRows(content, lang).map(r => `${r.kind}:${r.id}:${r.field}`));
  const suffix = LANGUAGES[lang].suffix;
  let next: Content = { ...content, places: [...content.places], routes: [...content.routes] };
  let glossary = [...glossaryOf(content)];
  let periods = [...(content.specialPeriods ?? [])];
  let glossaryTouched = false;
  let filled = 0;
  let alreadyFilled = 0;
  let unknown = 0;
  for (const r of rows.slice(1)) {
    const [kind, id, field] = r.map(c => c.trim());
    const value = unguard(r[5] ?? '').trim();
    if (!value) continue;
    const valid = ['place', 'route', 'term', 'period'].includes(kind) && field?.endsWith(suffix);
    const base = valid ? field.slice(0, -suffix.length) : '';
    const find = (): Rec | undefined =>
      kind === 'place' ? next.places.find(p => String(p.id) === id) as unknown as Rec
      : kind === 'route' ? next.routes.find(x => x.id === id) as unknown as Rec
      : kind === 'term' ? glossary.find(t => t.id === id) as unknown as Rec
      : kind === 'period' ? periods.find(s => s.id === id) as unknown as Rec
      : undefined;
    const item = valid ? find() : undefined;
    // A field the export lists for this kind of item, with English to translate.
    if (!item || typeof item[`${base}En`] === 'undefined' && !LIST_FIELDS.has(base)) {
      unknown++;
      continue;
    }
    if (!open.has(`${kind}:${id}:${field}`)) {
      alreadyFilled++;
      continue;
    }
    const v = LIST_FIELDS.has(base) ? value.split('\n').map(x => x.trim()).filter(Boolean) : value;
    const updated = { ...item, [field]: v };
    if (kind === 'place') next.places = next.places.map(p => (String(p.id) === id ? (updated as never) : p));
    else if (kind === 'route') next.routes = next.routes.map(x => (x.id === id ? (updated as never) : x));
    else if (kind === 'term') {
      glossary = glossary.map(t => (t.id === id ? (updated as never) : t));
      glossaryTouched = true;
    } else periods = periods.map(s => (s.id === id ? (updated as never) : s));
    open.delete(`${kind}:${id}:${field}`);
    filled++;
  }
  if (glossaryTouched) next = { ...next, glossary };
  if (content.specialPeriods) next = { ...next, specialPeriods: periods };
  return { ok: true, lang, content: next, filled, alreadyFilled, unknown };
}
