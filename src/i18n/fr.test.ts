import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FR } from './fr';

// Every English string the visitor app passes to L() (or its local aliases)
// should have a French translation.
describe('French interface text', () => {
  it('covers every string in the visitor app', () => {
    const dir = join(__dirname, '../components');
    const used = new Set<string>();
    const call = /(?<![\w.])(?:L|T|t)\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,/g;
    const option = /\ben: '((?:\\.|[^'])*)'/g;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(call)) used.add(m[2].replace(/\\'/g, "'"));
      for (const m of src.matchAll(option)) used.add(m[1].replace(/\\'/g, "'"));
    }
    const missing = [...used].filter(s => !(s in FR));
    expect(used.size).toBeGreaterThan(80);
    expect(missing).toEqual([]);
  });
});
