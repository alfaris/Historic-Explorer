import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vercel runs the API as plain Node ES modules, which need full file extensions
// on relative imports. An import like './locations' works in Vite and Vitest
// but crashes the function at startup with ERR_MODULE_NOT_FOUND. This walks
// every file the API loads and checks its relative value imports.
const root = resolve(__dirname, '../..');
const importRe = /^\s*(import|export)\s+(?!type\b)[^;]*?from\s+'(\.{1,2}\/[^']+)'/gm;

const toSource = (spec: string) => spec.replace(/\.js$/, '.ts');

describe('API imports', () => {
  it('use .js extensions on every relative value import the server loads', () => {
    const entries = readdirSync(join(root, 'api'))
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map(f => join(root, 'api', f));
    const seen = new Set<string>();
    const problems: string[] = [];
    const queue = [...entries];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(importRe)) {
        const spec = m[2];
        if (!spec.endsWith('.js')) {
          problems.push(`${file.slice(root.length + 1)}: '${spec}' needs a .js extension`);
          continue;
        }
        const target = resolve(dirname(file), toSource(spec));
        if (!existsSync(target)) problems.push(`${file.slice(root.length + 1)}: '${spec}' doesn't exist`);
        else queue.push(target);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(problems).toEqual([]);
  });
});
