import { describe, expect, it } from 'vitest';
import { routeFromSearch, routeShareUrl } from './share';

describe('route links', () => {
  it('builds a link that opens the route', () => {
    expect(routeShareUrl('https://cairowalks.vercel.app', 'fustat-roda')).toBe('https://cairowalks.vercel.app/?route=fustat-roda');
  });

  it('reads the route back, and only accepts known routes', () => {
    const ids = ['ahl-al-bayt', 'fustat-roda'];
    expect(routeFromSearch('?route=fustat-roda', ids)).toBe('fustat-roda');
    expect(routeFromSearch('?route=nope', ids)).toBeNull();
    expect(routeFromSearch('', ids)).toBeNull();
    expect(routeFromSearch(new URL(routeShareUrl('https://x', 'ahl-al-bayt')).search, ids)).toBe('ahl-al-bayt');
  });
});
