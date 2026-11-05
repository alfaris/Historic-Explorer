import { describe, expect, it } from 'vitest';
import { parseVisited, serializeVisited } from './visited';

describe('parseVisited', () => {
  it('reads a stored list', () => {
    expect([...parseVisited('[3,1,2]')].sort()).toEqual([1, 2, 3]);
  });

  it.each([null, '', 'not json', '{"a":1}', '"1,2"', '42'])('treats %j as nothing visited', raw => {
    expect(parseVisited(raw).size).toBe(0);
  });

  it('drops values that are not place IDs', () => {
    expect([...parseVisited('[1, "2", -3, 0, 4.5, null, 7]')]).toEqual([1, 7]);
  });
});

describe('serializeVisited', () => {
  it('round-trips through parseVisited, sorted', () => {
    const raw = serializeVisited(new Set([30, 2, 105]));
    expect(raw).toBe('[2,30,105]');
    expect(parseVisited(raw)).toEqual(new Set([2, 30, 105]));
  });
});
