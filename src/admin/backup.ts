// Backups of the content the admin can keep outside the app: the whole content
// as JSON (which can be restored), and the places as a spreadsheet (CSV).

import { glossaryOf, normalizeContent, validateContent, type Content } from '../data/content';
import { categories } from '../data/locations';
import { placePhoto } from '../data/photos';
import { LANGS, LANGUAGES } from '../i18n/lang';
import { sameValue } from './ui';

const KIND = 'cairo-walks-content';

/** A file name with the date, e.g. cairo-walks-backup-2026-11-07.json. */
export const dated = (base: string, ext: string, now: Date) => `cairo-walks-${base}-${now.toISOString().slice(0, 10)}.${ext}`;

/** The whole content as a JSON backup file. */
export function backupFile(content: Content, now = new Date()) {
  const body = { kind: KIND, version: 1, savedAt: now.toISOString(), content };
  return { name: dated('backup', 'json', now), type: 'application/json', text: `${JSON.stringify(body, null, 2)}\n` };
}

export type ParsedBackup = { ok: true; content: Content; savedAt: string | null } | { ok: false; message: string; problems: string[] };

/**
 * Reads a backup file. It accepts the file made by backupFile and, for
 * safety's sake, bare content ({ routes, places }). The content is checked
 * exactly like a save.
 */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, message: "This file isn't a Cairo Walks backup: it isn't valid JSON.", problems: [] };
  }
  const wrapped = data && typeof data === 'object' && (data as { kind?: unknown }).kind === KIND;
  const raw = wrapped ? (data as { content?: unknown }).content : data;
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { routes?: unknown }).routes) || !Array.isArray((raw as { places?: unknown }).places)) {
    return { ok: false, message: "This file isn't a Cairo Walks backup: it has no routes and places.", problems: [] };
  }
  const content = normalizeContent(raw);
  const problems = validateContent(content);
  if (problems.length) return { ok: false, message: "This backup can't be restored as it is:", problems };
  const savedAt = wrapped ? (data as { savedAt?: unknown }).savedAt : null;
  return { ok: true, content, savedAt: typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt)) ? savedAt : null };
}

export interface Change {
  added: number;
  removed: number;
  changed: number;
  /** How many there are after restoring. */
  total: number;
}
export interface BackupDiff {
  places: Change;
  routes: Change;
  glossary: Change;
  specialPeriods: Change;
  /** True when the backup is the same as the current content. */
  same: boolean;
}

function compare<T>(current: T[], next: T[], key: (x: T) => string | number): Change {
  const before = new Map(current.map(x => [key(x), x]));
  const after = new Map(next.map(x => [key(x), x]));
  let added = 0;
  let changed = 0;
  for (const [k, x] of after) {
    const old = before.get(k);
    if (old === undefined) added++;
    else if (!sameValue(old, x)) changed++;
  }
  const removed = [...before.keys()].filter(k => !after.has(k)).length;
  return { added, removed, changed, total: after.size };
}

/** What restoring `next` would change, compared with `current`. */
export function backupDiff(current: Content, next: Content): BackupDiff {
  const diff = {
    places: compare(current.places, next.places, p => p.id),
    routes: compare(current.routes, next.routes, r => r.id),
    // Content without a saved glossary uses the built-in one.
    glossary: compare(glossaryOf(current), glossaryOf(next), t => t.id),
    specialPeriods: compare(current.specialPeriods ?? [], next.specialPeriods ?? [], s => s.id),
  };
  const same = Object.values(diff).every(c => c.added === 0 && c.removed === 0 && c.changed === 0);
  return { ...diff, same };
}

/** One line of the summary, e.g. "Places: 52 (2 added, 1 removed, 3 changed)". */
export function describeChange(label: string, c: Change): string {
  const parts = [c.added && `${c.added} added`, c.removed && `${c.removed} removed`, c.changed && `${c.changed} changed`].filter(Boolean);
  return `${label}: ${c.total}${parts.length ? ` (${parts.join(', ')})` : ', no change'}`;
}

// --- Places spreadsheet ---

/**
 * One CSV cell: quoted, with quotes doubled. A cell that a spreadsheet would
 * read as a formula (=, +, -, @ first) starts with an apostrophe instead.
 */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const CSV_TYPE = 'text/csv;charset=utf-8';

/**
 * Rows as CSV text. It starts with a byte-order mark and uses CRLF line ends,
 * so Excel reads non-Latin text (Arabic) as UTF-8; Google Sheets does too.
 */
export const csvText = (rows: unknown[][]) => `\uFEFF${rows.map(r => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

/**
 * The places as a CSV spreadsheet. It starts with a byte-order mark and uses
 * CRLF line ends, so Excel reads the Arabic as UTF-8; Google Sheets does too.
 */
export function placesCsv(content: Content, now = new Date()) {
  const routeName = new Map(content.routes.map(r => [r.id, r.nameEn]));
  const categoryName = new Map(categories.map(c => [c.id, c.nameEn]));
  const header = [
    'ID',
    'Route ID',
    'Route',
    'Category',
    ...LANGS.map(l => `Name (${LANGUAGES[l].english})`),
    ...LANGS.map(l => `Description (${LANGUAGES[l].english})`),
    'Latitude',
    'Longitude',
    'Opening hours set',
    'Photo credit',
  ];
  const rows = content.places.map(p => {
    const photo = p.photo ?? placePhoto(p.id);
    return [
      p.id,
      p.routeId,
      routeName.get(p.routeId) ?? '',
      categoryName.get(p.category) ?? p.category,
      ...LANGS.map(l => (p as unknown as Record<string, string | undefined>)[`name${LANGUAGES[l].suffix}`] ?? ''),
      ...LANGS.map(l => (p as unknown as Record<string, string | undefined>)[`description${LANGUAGES[l].suffix}`] ?? ''),
      p.lat,
      p.lng,
      p.hours ? 'Yes' : 'No',
      photo ? `${photo.author} (${photo.license})` : '',
    ];
  });
  return { name: dated('places', 'csv', now), type: CSV_TYPE, text: csvText([header, ...rows]) };
}

/** Saves a file made above to the admin's computer. */
export function downloadFile(file: { name: string; type: string; text: string }) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  a.download = file.name;
  a.click();
  // Some browsers start the download after this tick; revoke a little later.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
