import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FR } from './fr';
import { ES } from './es';

// Every English string the visitor app passes to L() (or its local aliases)
// should have a translation in each language that uses a dictionary.
const used = new Set<string>();
const dir = join(__dirname, '../components');
const call = /(?<![\w.])(?:L|T|t)\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,/g;
const option = /\ben: '((?:\\.|[^'])*)'/g;
for (const f of readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
  const src = readFileSync(join(dir, f), 'utf8');
  for (const m of src.matchAll(call)) used.add(m[2].replace(/\\'/g, "'"));
  for (const m of src.matchAll(option)) used.add(m[1].replace(/\\'/g, "'"));
}

describe.each([['fr', FR], ['es', ES]] as const)('%s interface text', (_lang, dictionary: Record<string, string>) => {
  it('covers every string in the visitor app', () => {
    expect(used.size).toBeGreaterThan(80);
    expect([...used].filter(s => !(s in dictionary))).toEqual([]);
  });
  it('has no empty translations', () => {
    expect(Object.entries(dictionary).filter(([, v]) => !v.trim())).toEqual([]);
  });
});

it('French and Spanish translate the same strings', () => {
  expect(Object.keys(ES).sort()).toEqual(Object.keys(FR).sort());
});
