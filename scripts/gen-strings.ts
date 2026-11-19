// Writes contracts/strings/catalog.json (see scripts/strings-catalog.ts); fails on any problem.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCatalog, CATALOG_PATH, catalogText } from './strings-catalog.js';

const { problems } = buildCatalog();
if (problems.length) {
  for (const p of problems) console.error(`${p.at}: ${p.problem}`);
  process.exit(1);
}
mkdirSync('contracts/strings', { recursive: true });
writeFileSync(CATALOG_PATH, catalogText());
console.log(`Wrote ${CATALOG_PATH}`);
