import { describe, expect, it } from 'vitest';
import { filterPlaces, groupByPlace, reportsLabel } from './report-groups';
import type { Content } from '../data/content';
import type { Report } from './api';

const content = {
  places: [
    { id: 1, routeId: 'muizz' },
    { id: 2, routeId: 'muizz' },
    { id: 3, routeId: 'coptic' },
  ],
} as unknown as Content;

const report = (id: string, placeId: number, createdAt: string): Report => ({
  id, placeId, createdAt, status: 'open', type: 'text', placeName: `Place ${placeId}`, message: 'x', lang: 'en',
});

describe('filterPlaces', () => {
  it('covers every place, a route, or one place', () => {
    expect(filterPlaces(content, { route: 'all', type: 'all', placeId: null })).toBeUndefined();
    expect(filterPlaces(content, { route: 'muizz', type: 'all', placeId: null })).toEqual([1, 2]);
    expect(filterPlaces(content, { route: 'gone', type: 'all', placeId: null })).toEqual([]);
    expect(filterPlaces(content, { route: 'muizz', type: 'closed', placeId: 3 })).toEqual([3]);
  });
});

describe('groupByPlace', () => {
  it('groups by place, newest place first, each newest first', () => {
    const groups = groupByPlace([
      report('a', 2, '2026-11-15T10:00:00Z'),
      report('b', 1, '2026-11-14T10:00:00Z'),
      report('c', 2, '2026-11-13T10:00:00Z'),
    ]);
    expect(groups.map(g => [g.placeId, g.reports.map(r => r.id)])).toEqual([[2, ['a', 'c']], [1, ['b']]]);
  });
});

it('labels counts', () => {
  expect(reportsLabel(1)).toBe('1 report');
  expect(reportsLabel(3)).toBe('3 reports');
});
