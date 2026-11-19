// Writes the JSON Schema of the native apps' content API (GET /api/v1/content)
// from the TypeScript types, so the apps' Kotlin models are generated from the
// same source as the web's. Run after changing Content or the v1 envelope:
//   npm run gen:schema
// A test fails while the checked-in schema is out of date.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentSchemaText, SCHEMA_PATH } from './content-schema.js';

writeFileSync(fileURLToPath(new URL(`../${SCHEMA_PATH}`, import.meta.url)), contentSchemaText());
console.log(`Wrote ${SCHEMA_PATH}`);
