// Cache Storage names shared by the service worker (vite.config.ts) and the
// offline route download (offline-store.ts). Downloads put files straight into
// these caches, so the service worker serves them when there's no connection.
// Kept free of imports so vite.config.ts can load it.

export const OFFLINE_CACHES = {
  tiles: 'leaflet-tiles',
  photos: 'place-photos',
  audio: 'audio-guides',
} as const;

/**
 * The live routes and places (/api/content). Not part of OFFLINE_CACHES: it
 * isn't per route, is refreshed on every download, and is never deleted.
 */
export const CONTENT_CACHE = 'content';
export const CONTENT_URL = '/api/content';

export type OfflineCacheKind = keyof typeof OFFLINE_CACHES;
