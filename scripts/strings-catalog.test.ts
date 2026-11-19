// The interface text catalog for the native apps must hold every L(en, ar)
// string in the web, each under its own key, and be up to date.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog, CATALOG_PATH, catalogText, keyOf, RESERVED } from './strings-catalog';

describe('string catalog', () => {
  it('has no problems: every L() call takes literals, one Arabic text per English, no two strings on one key', () => {
    expect(buildCatalog().problems).toEqual([]);
  });

  it('is up to date with the source (run npm run gen:strings)', () => {
    const checkedIn = readFileSync(new URL(`../${CATALOG_PATH}`, import.meta.url), 'utf8');
    expect(JSON.parse(checkedIn)).toEqual(JSON.parse(catalogText()));
  });

  it('gives every entry English, Arabic, French and Spanish', () => {
    const entries = Object.values(buildCatalog().catalog.entries);
    expect(entries.length).toBeGreaterThan(300);
    expect(entries.filter(e => !e.en || !e.ar || !e.fr || !e.es).map(e => e.en)).toEqual([]);
  });

  it('makes keys an Android resource name and an iOS key can use', () => {
    for (const key of Object.keys(buildCatalog().catalog.entries)) expect(key).toMatch(/^[a-z][a-z0-9_]{0,59}$/);
    expect(keyOf("The map couldn't load. Check your connection.")).toBe('the_map_couldn_t_load_check_your_connection');
    expect(keyOf('3 € & more')).toBe('s_3_and_more');
    expect(keyOf('Café')).toBe('cafe');
    // Java and Kotlin keywords can't be Android resource names.
    expect(keyOf('Continue')).toBe('continue_text');
    for (const key of Object.keys(buildCatalog().catalog.entries)) expect(RESERVED.has(key), key).toBe(false);
  });

  it('takes text from every file that imports L, however it names it', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) && !/\.test\./.test(d.name) ? [join(dir, d.name)] : []));
    const root = new URL('..', import.meta.url).pathname;
    const importers = files(join(root, 'src'))
      .filter(f => /import\s*\{[^}]*\bL\b[^}]*\}\s*from\s*'[./]*(?:i18n\/)?lang(?:\.js)?'/.test(readFileSync(f, 'utf8')))
      .map(f => f.slice(root.length));
    expect(importers.length).toBeGreaterThan(40);
    const used = new Set(Object.values(buildCatalog().catalog.entries).flatMap(e => e.files));
    expect(importers.filter(f => !used.has(f))).toEqual([]);
  });

  it('gives byLang templates their text with numbered placeholders', () => {
    const { templates } = buildCatalog().catalog;
    expect(templates.filter(t => t.texts.en !== null).length).toBeGreaterThan(50);
    const resume = templates.find(t => t.texts.en === 'Resume from {0}');
    expect(resume?.args.en).toEqual(['clockLabel(resumeAt)']);
  });

  it('says how many templates number their placeholders differently by language (so none is fed to a generator as is)', () => {
    const { templates } = buildCatalog().catalog;
    const misaligned = templates.filter(t => Object.values(t.args).some(a => JSON.stringify(a) !== JSON.stringify(t.args.en ?? [])));
    // Most do: plurals and agreement live in each language's own expressions.
    expect(misaligned.length).toBeGreaterThan(20);
    expect(buildCatalog().catalog.about).toMatch(/not generator input/);
  });
});
