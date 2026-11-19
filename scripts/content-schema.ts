import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

export const SCHEMA_PATH = 'contracts/content-v1.schema.json';
const root = fileURLToPath(new URL('..', import.meta.url));

/** The schema of ContentV1 (api/_lib/content-v1.ts) as formatted JSON text. */
export function contentSchemaText(): string {
  const schema = createGenerator({
    path: `${root}api/_lib/content-v1.ts`,
    tsconfig: `${root}tsconfig.json`,
    type: 'ContentV1',
    skipTypeCheck: true,
    additionalProperties: true, // apps decode leniently: new fields are additions
    sortProps: true,
  }).createSchema('ContentV1');
  return `${JSON.stringify(schema, null, 2)}\n`;
}
