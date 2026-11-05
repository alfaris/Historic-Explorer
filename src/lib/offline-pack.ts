// Works out every file a route needs to work with no connection: its map
// tiles, photos, and audio guides. Pure, so it's easy to test; the download
// itself is in offline-store.ts.

import type { Location, Route } from '../data/locations';
import { photoForPlace, photoForRoute, smallPhotoSrc } from '../data/photo-resolve';
import { textHash } from './text-hash';
import type { OfflineCacheKind } from './offline-caches';

export type Lang = 'en' | 'ar';

/** The narrated text of a place's audio guide. */
export const audioText = (place: Pick<Location, 'descriptionEn' | 'descriptionAr'>, lang: Lang) =>
  (lang === 'ar' ? place.descriptionAr : place.descriptionEn) || '';

/**
 * The audio guide URL. It carries a hash of the narrated text, so editing a
 * description in the admin gives it a new URL instead of a stale recording.
 * AudioGuide and the offline download must build exactly the same URL.
 */
export const audioGuideUrl = (id: number, lang: Lang, text: string) =>
  `/api/audio-guide?id=${id}&lang=${lang}&v=${textHash(text)}`;

// Tile maths for the Web Mercator tiles OpenStreetMap serves.
export const lngToTileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
export const latToTileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

// Must match the TileLayer in MapView exactly (Leaflet picks the subdomain
// from x + y), or the cached tiles are never used.
const SUBDOMAINS = ['a', 'b', 'c'];
export const tileUrl = (z: number, x: number, y: number) =>
  `https://${SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length]}.tile.openstreetmap.org/${z}/${x}/${y}.png`;

// OpenStreetMap's tile policy forbids bulk downloads, especially of large
// areas at zoom 17 and above. So: the whole route area only up to zoom 16,
// zoom 17 only right around each stop, and a hard cap per route.
const AREA_ZOOMS = [14, 15, 16];
const STOP_ZOOM = 17;
const AREA_MARGIN = 0.004; // degrees (~400 m) around the outermost stops
export const MAX_TILES = 400;

export function tilesForPlaces(places: Pick<Location, 'lat' | 'lng'>[]): string[] {
  if (places.length === 0) return [];
  const lats = places.map(p => p.lat);
  const lngs = places.map(p => p.lng);
  const [minLat, maxLat] = [Math.min(...lats) - AREA_MARGIN, Math.max(...lats) + AREA_MARGIN];
  const [minLng, maxLng] = [Math.min(...lngs) - AREA_MARGIN, Math.max(...lngs) + AREA_MARGIN];

  const urls = new Set<string>();
  for (const z of AREA_ZOOMS) {
    for (let x = lngToTileX(minLng, z); x <= lngToTileX(maxLng, z); x++) {
      for (let y = latToTileY(maxLat, z); y <= latToTileY(minLat, z); y++) urls.add(tileUrl(z, x, y));
    }
  }
  // The tile each stop is on and its eight neighbours, so the street around
  // it stays readable when zoomed in.
  for (const p of places) {
    const cx = lngToTileX(p.lng, STOP_ZOOM);
    const cy = latToTileY(p.lat, STOP_ZOOM);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) urls.add(tileUrl(STOP_ZOOM, cx + dx, cy + dy));
  }
  // Insertion order puts lower zooms first, so the cap drops close-ups first.
  return [...urls].slice(0, MAX_TILES);
}

export type PackFile = { url: string; kind: OfflineCacheKind };

/** Everything a route needs offline, in the given language. */
export function routePack(route: Pick<Route, 'id' | 'photo'>, places: Location[], lang: Lang): PackFile[] {
  const files: PackFile[] = [];
  const seen = new Set<string>();
  const add = (url: string | undefined, kind: OfflineCacheKind) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      files.push({ url, kind });
    }
  };
  for (const p of places) {
    const text = audioText(p, lang);
    if (text) add(audioGuideUrl(p.id, lang, text), 'audio');
  }
  // Both sizes of each photo: the browser may pick the small copy (srcset),
  // and offline it won't fall back to the full one if that's all that's saved.
  const addPhoto = (src: string | undefined) => {
    add(src, 'photos');
    if (src) add(smallPhotoSrc(src) ?? undefined, 'photos');
  };
  addPhoto(photoForRoute(route)?.src);
  for (const p of places) addPhoto(photoForPlace(p)?.src);
  for (const url of tilesForPlaces(places)) add(url, 'tiles');
  return files;
}
