import { describe, expect, it } from 'vitest';
import { locations, routes } from '../data/locations';
import { audioGuideUrl, latToTileY, lngToTileX, MAX_TILES, routePack, tilesForPlaces, tileUrl } from './offline-pack';
import { audioVersion } from './text-hash';

describe('tile maths', () => {
  it('matches known OpenStreetMap tiles', () => {
    // Ibn Tulun Mosque at zoom 16.
    expect(lngToTileX(31.25024, 16)).toBe(38456);
    expect(latToTileY(30.02871, 16)).toBe(27032);
  });

  it('picks the subdomain the way Leaflet does', () => {
    expect(tileUrl(16, 1, 1)).toBe('https://c.tile.openstreetmap.org/16/1/1.png');
    expect(tileUrl(16, 1, 2)).toBe('https://a.tile.openstreetmap.org/16/1/2.png');
  });
});

describe('tilesForPlaces', () => {
  it('stays within the zoom levels the tile policy allows, up to the cap', () => {
    for (const route of routes) {
      const tiles = tilesForPlaces(locations.filter(l => l.routeId === route.id));
      expect(tiles.length).toBeGreaterThan(0);
      expect(tiles.length).toBeLessThanOrEqual(MAX_TILES);
      const zooms = new Set(tiles.map(t => Number(t.split('/')[3])));
      expect([...zooms].every(z => z >= 14 && z <= 17)).toBe(true);
      expect(new Set(tiles).size).toBe(tiles.length);
    }
  });

  it('covers each stop at zoom 17', () => {
    const place = locations[0];
    const tiles = tilesForPlaces([place]);
    expect(tiles).toContain(tileUrl(17, lngToTileX(place.lng, 17), latToTileY(place.lat, 17)));
  });

  it('drops close-ups first when over the cap', () => {
    const spread = Array.from({ length: 60 }, (_, i) => ({ lat: 30 + i * 0.01, lng: 31.2 + i * 0.01 }));
    const tiles = tilesForPlaces(spread);
    expect(tiles.length).toBe(MAX_TILES);
    expect(tiles[0]).toMatch(/\/14\//);
  });

  it('is empty without places', () => {
    expect(tilesForPlaces([])).toEqual([]);
  });
});

describe('routePack', () => {
  const route = routes.find(r => r.id === 'ahl-al-bayt')!;
  const places = locations.filter(l => l.routeId === route.id);

  it('includes an audio guide per place in the chosen language, versioned by its text', () => {
    const audio = routePack(route, places, 'ar').filter(f => f.kind === 'audio').map(f => f.url);
    expect(audio).toHaveLength(places.length);
    expect(audio[0]).toBe(`/api/audio-guide?id=${places[0].id}&lang=ar&v=${audioVersion(places[0].descriptionAr)}`);
    expect(audio[0]).toBe(audioGuideUrl(places[0].id, 'ar', places[0].descriptionAr));
  });

  it('includes photos and tiles, with no duplicates', () => {
    const pack = routePack(route, places, 'en');
    expect(pack.some(f => f.kind === 'photos')).toBe(true);
    expect(pack.some(f => f.kind === 'tiles')).toBe(true);
    expect(new Set(pack.map(f => f.url)).size).toBe(pack.length);
  });

  it('gives an edited description a new audio URL', () => {
    const edited = places.map((p, i) => (i === 0 ? { ...p, descriptionEn: p.descriptionEn + ' Updated.' } : p));
    const before = routePack(route, places, 'en').filter(f => f.kind === 'audio');
    const after = routePack(route, edited, 'en').filter(f => f.kind === 'audio');
    expect(after[0].url).not.toBe(before[0].url);
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it('skips audio for places with no description', () => {
    const pack = routePack(route, [{ ...places[0], descriptionEn: '' }], 'en');
    expect(pack.filter(f => f.kind === 'audio')).toEqual([]);
  });
});

describe('routePack photos', () => {
  it('includes the small and thumbnail copies of each built-in photo, for srcset offline', () => {
    const route = routes.find(r => r.id === 'ahl-al-bayt')!;
    const photos = routePack(route, locations.filter(l => l.routeId === route.id), 'en').filter(f => f.kind === 'photos').map(f => f.url);
    const full = photos.filter(u => !/-(240|480)\.webp$/.test(u));
    expect(full.length).toBeGreaterThan(0);
    for (const u of full) {
      if (!u.startsWith('/images/photos/')) continue;
      expect(photos).toContain(u.replace(/\.webp$/, '-480.webp'));
      expect(photos).toContain(u.replace(/\.webp$/, '-240.webp'));
    }
  });
});

describe('offline zoom levels', () => {
  it('exposes the downloaded zooms that walk mode’s map stays within', async () => {
    const { OFFLINE_AREA_MAX_ZOOM, OFFLINE_MAX_ZOOM, tilesForPlaces } = await import('./offline-pack');
    expect(OFFLINE_AREA_MAX_ZOOM).toBe(16);
    expect(OFFLINE_MAX_ZOOM).toBe(17);
    const zooms = new Set(tilesForPlaces([{ lat: 30.05, lng: 31.26 }]).map(u => Number(u.split('/')[3])));
    expect(Math.max(...zooms)).toBe(OFFLINE_MAX_ZOOM);
    expect(zooms.has(OFFLINE_AREA_MAX_ZOOM)).toBe(true);
  });
});
