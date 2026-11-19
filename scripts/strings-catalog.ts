// The interface text catalog for the native apps (contracts/strings/catalog.json):
// every L(en, ar) string in the web, with its French and Spanish from the
// dictionaries, under a stable key the apps' string resources use. Read-only:
// the web keeps writing L(en, ar) where the text is used.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { ES } from '../src/i18n/es.js';
import { FR } from '../src/i18n/fr.js';

export const CATALOG_PATH = 'contracts/strings/catalog.json';
const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

export interface Entry {
  en: string;
  ar: string;
  fr: string | null;
  es: string | null;
  /** Source files that use it. */
  files: string[];
}

export interface Problem {
  at: string;
  problem: string;
}

/** A key the apps can use as an Android resource name and an iOS key: lowercase letters, digits and underscores, from the English. */
/** Keys chosen by hand where two English texts would get the same one (they differ only in case or punctuation). */
const KEY_OVERRIDES: Record<string, string> = {
  stops: 'stops_count', // "3/12 stops", beside "Stops" (the heading)
};
/** The same for the keyed table's keys: t('directions') is "Get Directions", beside L('Directions'). */
const TABLE_KEY_OVERRIDES: Record<string, string> = {
  directions: 'get_directions',
};

export function keyOf(en: string): string {
  if (en in KEY_OVERRIDES) return KEY_OVERRIDES[en];
  const words = en
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  let key = '';
  for (const w of words) {
    if (key && key.length + 1 + w.length > 48) break;
    key = key ? `${key}_${w}` : w;
  }
  key ||= 'text';
  return /^[a-z]/.test(key) ? key : `s_${key}`;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

const literal = (n: ts.Expression | undefined): string | null =>
  n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

export function scan() {
  const strings: { en: string; ar: string; file: string; at: string }[] = [];
  const templates: { at: string; texts: Record<string, string | null> }[] = [];
  const problems: Problem[] = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(ROOT, path).split('\\').join('/');
    if (file === 'src/i18n/lang.ts') continue; // where L is defined
    const text = readFileSync(path, 'utf8');
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    // Names bound to L in this file: L itself, and aliases like `const t = L`.
    const names = new Set(['L']);
    const findAliases = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isIdentifier(n.initializer) && n.initializer.text === 'L') names.add(n.name.text);
      ts.forEachChild(n, findAliases);
    };
    findAliases(source);
    const where = (n: ts.Node) => `${file}:${source.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const callee = n.expression.text;
        if (names.has(callee)) {
          const [enArg, arArg] = n.arguments;
          const en = literal(enArg);
          const ar = literal(arArg);
          // L(option.en, option.ar): text kept in {en, ar} objects, which are collected below.
          const fromObject =
            n.arguments.length === 2 && enArg && arArg && ts.isPropertyAccessExpression(enArg) && ts.isPropertyAccessExpression(arArg) &&
            enArg.name.text === 'en' && arArg.name.text === 'ar' && enArg.expression.getText() === arArg.expression.getText();
          if (fromObject) objectCalls = true;
          else if (en === null || ar === null || n.arguments.length !== 2) problems.push({ at: where(n), problem: `${callee}() takes two string literals, or (x.en, x.ar)` });
          else strings.push({ en, ar, file, at: where(n) });
        } else if (callee === 'byLang') {
          inByLang.add(n.arguments[0]);
          const arg = n.arguments[0];
          const texts: Record<string, string | null> = {};
          if (arg && ts.isObjectLiteralExpression(arg)) {
            for (const p of arg.properties) {
              if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) texts[p.name.text] = literal(p.initializer as ts.Expression);
            }
          }
          templates.push({ at: where(n), texts });
        }
      }
      // {en: '…', ar: '…'} objects outside byLang(): options passed to L(x.en, x.ar).
      if (ts.isObjectLiteralExpression(n) && !inByLang.has(n)) {
        const props = new Map<string, string | null>();
        for (const p of n.properties) if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) props.set(p.name.text, literal(p.initializer));
        const en = props.get('en');
        const ar = props.get('ar');
        if (en && ar) options.push({ en, ar, file, at: where(n) });
      }
      ts.forEachChild(n, visit);
    };
    let objectCalls = false;
    const inByLang = new Set<ts.Node | undefined>();
    const options: { en: string; ar: string; file: string; at: string }[] = [];
    visit(source);
    // Option objects count only in a file that passes them to L().
    if (objectCalls) strings.push(...options);
  }
  return { strings, templates, problems };
}

/** The keyed table in LanguageContext.tsx, read with t('app.title'): its own keys, in all four languages. */
export function keyedTable(): Record<string, Record<string, string>> {
  const path = join(SRC, 'i18n/LanguageContext.tsx');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const table: Record<string, Record<string, string>> = {};
  const visit = (n: ts.Node) => {
    // `const translations = { … } satisfies …` (or `as const`): the object inside.
    let init = ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'translations' ? n.initializer : undefined;
    while (init && (ts.isSatisfiesExpression(init) || ts.isAsExpression(init) || ts.isParenthesizedExpression(init))) init = init.expression;
    if (init && ts.isObjectLiteralExpression(init)) {
      for (const langProp of init.properties) {
        if (!ts.isPropertyAssignment(langProp) || !ts.isIdentifier(langProp.name) || !ts.isObjectLiteralExpression(langProp.initializer)) continue;
        for (const p of langProp.initializer.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const key = ts.isStringLiteral(p.name) || ts.isIdentifier(p.name) ? p.name.text : null;
          const text = literal(p.initializer);
          if (key && text !== null) (table[key] ??= {})[langProp.name.text] = text;
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(source);
  return table;
}

export function buildCatalog() {
  const { strings, templates, problems } = scan();
  const byEn = new Map<string, { ar: Set<string>; files: Set<string>; at: string[] }>();
  for (const s of strings) {
    const e = byEn.get(s.en) ?? { ar: new Set(), files: new Set(), at: [] };
    e.ar.add(s.ar);
    e.files.add(s.file);
    e.at.push(s.at);
    byEn.set(s.en, e);
  }
  const entries: Record<string, Entry> = {};
  const owner = new Map<string, string>();
  for (const [en, e] of [...byEn].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (e.ar.size > 1) problems.push({ at: e.at.join(', '), problem: `"${en}" has ${e.ar.size} different Arabic texts: ${[...e.ar].join(' | ')}` });
    const key = keyOf(en);
    const other = owner.get(key);
    if (other !== undefined) {
      problems.push({ at: e.at.join(', '), problem: `key "${key}" is taken by "${other}" and "${en}"` });
      continue;
    }
    owner.set(key, en);
    entries[key] = { en, ar: [...e.ar][0], fr: FR[en] ?? null, es: ES[en] ?? null, files: [...e.files].sort() };
  }
  for (const [tKey, texts] of Object.entries(keyedTable())) {
    const key = TABLE_KEY_OVERRIDES[tKey] ?? tKey.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const other = owner.get(key);
    if (other !== undefined) {
      problems.push({ at: 'src/i18n/LanguageContext.tsx', problem: `key "${key}" (t('${tKey}')) is taken by "${other}"` });
      continue;
    }
    if (!texts.en || !texts.ar) problems.push({ at: 'src/i18n/LanguageContext.tsx', problem: `t('${tKey}') has no ${texts.en ? 'Arabic' : 'English'}` });
    owner.set(key, `t('${tKey}')`);
    entries[key] = { en: texts.en ?? '', ar: texts.ar ?? '', fr: texts.fr ?? null, es: texts.es ?? null, files: ['src/i18n/LanguageContext.tsx'] };
  }
  const sortedEntries = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    catalog: {
      about:
        'The web\'s interface text, for the native apps\' string resources. Each entry is an L(en, ar) string from src, under a stable key (from the English: ' +
        'lowercase letters, digits and underscores), with French and Spanish from src/i18n/fr.ts and es.ts (null: not translated yet, the web shows English). ' +
        'The older keyed table read with t(\'app.title\') (src/i18n/LanguageContext.tsx) is included under its own keys, dots made underscores. ' +
        '`files` lists where it is used. `templates` lists the byLang({...}) texts, built around numbers or names, which move to keyed templates as each app ' +
        'screen is built. Generated by npm run gen:strings; do not edit by hand.',
      entries: sortedEntries,
      templates: templates.sort((a, b) => (a.at < b.at ? -1 : 1)),
    },
    problems,
  };
}

/** One entry per line, so a diff shows which strings changed. */
export function catalogText(): string {
  const { catalog } = buildCatalog();
  const entries = Object.entries(catalog.entries).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const templates = catalog.templates.map(t => `    ${JSON.stringify(t)}`).join(',\n');
  return `{\n  "about": ${JSON.stringify(catalog.about)},\n  "entries": {\n${entries}\n  },\n  "templates": [\n${templates}\n  ]\n}\n`;
}
