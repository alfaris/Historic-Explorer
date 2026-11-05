import { describe, expect, it } from 'vitest';
import { isRouteLink, routeFromLocation, routeShareUrl } from './share';

const at = (href: string) => new URL(href, 'https://x');
const ids = ['ahl-al-bayt', 'fustat-roda'];

describe('route links', () => {
  it('builds a /r/ link that opens the route', () => {
    expect(routeShareUrl('https://cairowalks.vercel.app', 'fustat-roda')).toBe('https://cairowalks.vercel.app/r/fustat-roda');
  });

  it('reads the route from /r/<id> and from ?route=<id>', () => {
    expect(routeFromLocation(at('/r/fustat-roda'), ids)).toBe('fustat-roda');
    expect(routeFromLocation(at('/r/fustat-roda/'), ids)).toBe('fustat-roda');
    expect(routeFromLocation(at('/?route=ahl-al-bayt'), ids)).toBe('ahl-al-bayt');
    expect(routeFromLocation(at(routeShareUrl('https://x', 'ahl-al-bayt')), ids)).toBe('ahl-al-bayt');
  });

  it('only accepts known routes', () => {
    expect(routeFromLocation(at('/r/nope'), ids)).toBeNull();
    expect(routeFromLocation(at('/?route=nope'), ids)).toBeNull();
    expect(routeFromLocation(at('/'), ids)).toBeNull();
  });

  it('tells route links apart, resolved or not', () => {
    expect(isRouteLink(at('/r/nope'))).toBe(true);
    expect(isRouteLink(at('/?route=x'))).toBe(true);
    expect(isRouteLink(at('/?loc=1'))).toBe(false);
  });
});
