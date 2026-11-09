import { describe, expect, it } from 'vitest';
import { isPlaceLink, isRouteLink, placeFromLocation, placeShareUrl, routeFromLocation, routeShareUrl } from './share';
import { MAX_SHARED_PLACES, savedFromLocation, savedShareUrl } from './share';

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

describe('shared lists of places', () => {
  it('builds a short link: sorted, no repeats, no bad IDs, at most 50', () => {
    expect(savedShareUrl('https://x.app', [40, 12, 31, 12])).toBe('https://x.app/?saved=12,31,40');
    expect(savedShareUrl('https://x.app', [0, -3, 1.5, 7])).toBe('https://x.app/?saved=7');
    const many = Array.from({ length: 80 }, (_, i) => i + 1);
    expect(savedShareUrl('https://x.app', many).split('=')[1].split(',')).toHaveLength(MAX_SHARED_PLACES);
  });

  it('reads the IDs back, skipping malformed ones', () => {
    expect(savedFromLocation({ search: '?saved=12,31,40' })).toEqual([12, 31, 40]);
    expect(savedFromLocation({ search: '?saved=5,x,5,0,%2012,-1,1234567,7' })).toEqual([5, 12, 7]);
    expect(savedFromLocation({ search: '?saved=' })).toEqual([]);
    expect(savedFromLocation({ search: '?route=al-muizz' })).toBeNull();
    expect(savedFromLocation({ search: `?saved=${Array.from({ length: 80 }, (_, i) => i + 1).join(',')}` })).toHaveLength(MAX_SHARED_PLACES);
  });

  it('round-trips', () => {
    const url = new URL(savedShareUrl('https://x.app', [3, 1, 2]));
    expect(savedFromLocation(url)).toEqual([1, 2, 3]);
  });
});
