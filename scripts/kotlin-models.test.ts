// The apps' Kotlin content models (mobile/core-model) must match the checked-in
// JSON Schema, which matches the TypeScript types (api/_lib/content-schema.test.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kotlinModels, MODELS_PATH } from './kotlin-models';

describe('Kotlin content models', () => {
  it('are up to date with the schema (run npm run gen:models)', () => {
    expect(readFileSync(new URL(`../${MODELS_PATH}`, import.meta.url), 'utf8')).toBe(kotlinModels());
  });

  it('follow the decoding rules: enums as strings, IDs as Int, optional fields default to null, one class for PeriodEntry', () => {
    const kt = kotlinModels();
    expect(kt).toMatch(/object Category \{\n {4}const val MONUMENT = "monument"/);
    expect(kt).toMatch(/val category: String,/);
    expect(kt).toMatch(/data class Location\(\n[\s\S]*?val id: Int,/);
    expect(kt).toMatch(/val lat: Double,/);
    expect(kt).toMatch(/data class PeriodEntry\(\n {4}val closed: Boolean\? = null,\n {4}val days: List<List<TimeRange>>\? = null,\n\)/);
    expect(kt).toMatch(/val audio: Map<String, AudioUrls>,/);
  });
});
