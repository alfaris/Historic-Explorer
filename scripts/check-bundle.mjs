// Fails when the JavaScript a visitor downloads before the app first paints
// (the scripts and module preloads in dist/index.html, gzipped) grows past the
// budget. Run after `npm run build`; CI runs it. Raise the budget on purpose,
// in the same change that needs it, not to make a red build green.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 215;
const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="\/([^"]+\.js)"/g)].map(m => m[1]);
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`${total.toFixed(1).padStart(7)} KB  first-load JavaScript, gzipped (budget ${BUDGET_KB} KB)`);
if (!files.length) {
  console.error('No scripts found in dist/index.html: is the build there?');
  process.exit(1);
}
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(1)} KB. Load the new code lazily (React.lazy or import()), or raise BUDGET_KB on purpose.`);
  process.exit(1);
}
