// The checked-in JSON Schema of /api/v1/content (contracts/), which the native
// apps' models are generated from, must match the TypeScript types, and real
// responses must satisfy it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { bundledContent, normalizeContent } from '../../src/data/content';
import { contentSchemaText, SCHEMA_PATH } from '../../scripts/content-schema';
import { contentV1 } from './content-v1';

const checkedIn = readFileSync(new URL(`../../${SCHEMA_PATH}`, import.meta.url), 'utf8');

describe('content schema', () => {
  it('is up to date with the TypeScript types (run npm run gen:schema)', () => {
    // Compared as JSON, so a checkout with CRLF line endings doesn't fail it.
    expect(JSON.parse(checkedIn)).toEqual(JSON.parse(contentSchemaText()));
  }, 30_000);

  it('accepts the v1 response for the built-in content, and for content with every optional part', () => {
    const validate = new Ajv({ allErrors: true, strict: false }).compile(JSON.parse(checkedIn));
    const plain = JSON.parse(JSON.stringify(contentV1(normalizeContent(structuredClone(bundledContent)))));
    expect(validate(plain), JSON.stringify(validate.errors)).toBe(true);
    const full = normalizeContent({
      ...structuredClone(bundledContent),
      notices: [{ textEn: 'Closed for works', textAr: 'مغلق للصيانة', from: '2026-12-01', until: '2026-12-10', placeId: bundledContent.places[0].id, important: true }],
      maxPlaceId: 9000,
    });
    const v1 = JSON.parse(JSON.stringify(contentV1(full)));
    expect(validate(v1), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects a response missing a required part', () => {
    const validate = new Ajv({ strict: false }).compile(JSON.parse(checkedIn));
    const v1 = JSON.parse(JSON.stringify(contentV1(normalizeContent(structuredClone(bundledContent)))));
    delete v1.content.places;
    expect(validate(v1)).toBe(false);
  });

  it('types IDs and counts as integers, so app models get Int rather than Double', () => {
    const validate = new Ajv({ strict: false }).compile(JSON.parse(checkedIn));
    const fresh = () => JSON.parse(JSON.stringify(contentV1(normalizeContent(structuredClone(bundledContent)))));
    const fractionalId = fresh();
    fractionalId.content.places[0].id = 1.5;
    expect(validate(fractionalId)).toBe(false);
    const fractionalVersion = fresh();
    fractionalVersion.minAppVersion = 1.5;
    expect(validate(fractionalVersion)).toBe(false);
    const fractionalLat = fresh();
    fractionalLat.content.places[0].lat = 30.0459;
    expect(validate(fractionalLat)).toBe(true);
  });
});
