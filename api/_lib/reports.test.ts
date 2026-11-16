import { describe, expect, it } from 'vitest';
import { matchesFilter, parseReportName } from './reports';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('parseReportName', () => {
  it('reads the place and type from newer file names', () => {
    expect(parseReportName(`reports/open/2026-11-15T10-00-00-000Z_${ID}_p12_closed.json`))
      .toEqual({ key: '2026-11-15T10-00-00-000Z', id: ID, placeId: 12, type: 'closed' });
  });

  it('reads older file names without them', () => {
    expect(parseReportName(`reports/resolved/2026-11-15T10-00-00-000Z_${ID}.json`))
      .toEqual({ key: '2026-11-15T10-00-00-000Z', id: ID });
  });

  it('reads a name with an unknown type as an older one, and ignores other files', () => {
    expect(parseReportName(`reports/open/2026_${ID}_p12_weird.json`)).toEqual({ key: '2026', id: ID });
    expect(parseReportName('reports/open/notes.txt')).toBeNull();
  });
});

describe('matchesFilter', () => {
  const meta = { placeId: 12, type: 'closed' as const };
  it('matches by place and type', () => {
    expect(matchesFilter(meta, {})).toBe(true);
    expect(matchesFilter(meta, { placeIds: [12, 13] })).toBe(true);
    expect(matchesFilter(meta, { placeIds: [] })).toBe(false);
    expect(matchesFilter(meta, { type: 'closed' })).toBe(true);
    expect(matchesFilter(meta, { placeIds: [12], type: 'photo' })).toBe(false);
  });
  it('leaves out a report it could not read when filtering', () => {
    expect(matchesFilter(null, {})).toBe(true);
    expect(matchesFilter(null, { type: 'closed' })).toBe(false);
  });
});
