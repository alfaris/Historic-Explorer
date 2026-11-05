import { describe, expect, it } from 'vitest';
import { isPlaceLink, isRouteLink, placeFromLocation, placeShareUrl, routeFromLocation, routeShareUrl } from './share';

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

describe('place links', () => {
  it('builds /p/<id> links, with the language, English included', () => {
    expect(placeShareUrl('https://x', 12)).toBe('https://x/p/12');
    expect(placeShareUrl('https://x', 12, 'en')).toBe('https://x/p/12?lang=en');
    expect(placeShareUrl('https://x', 12, 'fr')).toBe('https://x/p/12?lang=fr');
  });
  it('reads /p/<id> and ?loc=<id>', () => {
    expect(placeFromLocation(at('/p/12'))).toBe(12);
    expect(placeFromLocation(at('/p/12/?lang=ar'))).toBe(12);
    expect(placeFromLocation(at('/?loc=7'))).toBe(7);
    expect(placeFromLocation(at('/p/abc'))).toBeNull();
    expect(placeFromLocation(at('/?loc=1e3'))).toBeNull();
    expect(placeFromLocation(at('/'))).toBeNull();
  });
  it('knows a place link even when it can’t be read', () => {
    expect(isPlaceLink(at('/p/abc'))).toBe(true);
    expect(isPlaceLink(at('/?loc=7'))).toBe(true);
    expect(isPlaceLink(at('/r/x'))).toBe(false);
  });
});
