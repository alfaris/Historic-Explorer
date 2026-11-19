// The golden vectors the native apps are checked against (contracts/vectors)
// must be what the web's code gives today. CI runs this in four time zones, as
// a visitor's phone may keep its home one. A change to src/lib that changes any
// output fails here until the vectors are regenerated (npm run gen:vectors).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VECTOR_SETS, vectorFileText, vectorPath } from './vectors/index';

describe('golden vectors', () => {
  for (const set of VECTOR_SETS) {
    it(`${set.name}.json is what the web gives today (run npm run gen:vectors)`, async () => {
      const checkedIn = readFileSync(new URL(`../${vectorPath(set)}`, import.meta.url), 'utf8');
      expect(JSON.parse(checkedIn)).toEqual(JSON.parse(await vectorFileText(set)));
    });
  }
});
