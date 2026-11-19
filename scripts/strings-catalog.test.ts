// The interface text catalog for the native apps must hold every L(en, ar)
// string in the web, each under its own key, and be up to date.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalog, CATALOG_PATH, catalogText, keyOf } from './strings-catalog';

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
  });
});
