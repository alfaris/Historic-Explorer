// The checked-in JSON Schema of /api/v1/content (contracts/), which the native
// apps' models are generated from, must match the TypeScript types, and real
// responses must satisfy it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { bundledContent, normalizeContent, usableContent } from '../../src/data/content';
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
    // A stored photo with a size that isn't whole pixels (a restored old version) is left out, not sent.
    const stored = structuredClone(bundledContent);
    const upload = { src: `/api/photo?id=${'a'.repeat(64)}`, width: 640, height: 480, author: 'Admin', license: 'Own photo', licenseUrl: null, sourceUrl: '' };
    const withPhoto = stored.places[0];
    withPhoto.photo = { ...upload, width: 640.5 };
    withPhoto.gallery = [upload, { ...upload, height: Number.NaN }];
    stored.routes[0].photo = { ...upload, height: 0.5 };
    const served = JSON.parse(JSON.stringify(contentV1(normalizeContent(stored))));
    expect(validate(served), JSON.stringify(validate.errors)).toBe(true);
    const place = served.content.places.find((p: { id: number }) => p.id === withPhoto.id);
    expect(place.photo).toBeUndefined();
    expect(place.gallery).toHaveLength(1);
    expect(served.content.routes[0].photo).toBeUndefined();
    // Values an app couldn't decode (out of the ranges validation allows) are left out too.
    const odd = structuredClone(bundledContent);
    // A start at a place that isn't sent: normalizing keeps it (the stored place exists), usableContent drops the place.
    odd.places.push({ ...odd.places[0], id: 1.5, routeId: odd.routes[0].id });
    odd.routes[0].startId = 1.5;
    odd.routes[0].metroMinutes = 1e12;
    odd.places[0].builtFrom = 99_999_999_999;
    odd.places[0].builtTo = 1400;
    odd.places[1].photo = { ...upload, width: 1e12 };
    const oddServed = JSON.parse(JSON.stringify(contentV1(usableContent(normalizeContent(odd))!)));
    expect(validate(oddServed), JSON.stringify(validate.errors)).toBe(true);
    expect(oddServed.content.routes[0].startId).toBeUndefined();
    expect(oddServed.content.routes[0].metroMinutes).toBeUndefined();
    expect(oddServed.content.places[0].builtFrom).toBeUndefined();
    expect(oddServed.content.places[0].builtTo).toBeUndefined();
    expect(oddServed.content.places.find((p: { id: number }) => p.id === odd.places[1].id).photo).toBeUndefined();
    // Times that aren't HH:MM (a restored old version) are left out of the ranges; the week keeps its seven days.
    const badTimes = structuredClone(bundledContent);
    badTimes.places[0].hours = { days: Array.from({ length: 7 }, (_, d) => (d === 0 ? [{ open: '9am', close: '17:00' }, { open: '18:00', close: '20:00' }] : [{ open: '09:00', close: '17:00' }])) };
    const timed = JSON.parse(JSON.stringify(contentV1(usableContent(normalizeContent(badTimes))!)));
    const h = timed.content.places.find((p: { id: number }) => p.id === badTimes.places[0].id).hours;
    expect(h.days).toHaveLength(7);
    expect(h.days[0]).toEqual([{ open: '18:00', close: '20:00' }]);
    expect(h.days[1]).toEqual([{ open: '09:00', close: '17:00' }]);
    const fractionalLat = fresh();
    fractionalLat.content.places[0].lat = 30.0459;
    expect(validate(fractionalLat)).toBe(true);
  });
});
