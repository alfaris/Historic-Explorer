// Cache Storage names shared by the service worker (vite.config.ts) and the
// offline route download (offline-store.ts). Downloads put files straight into
// these caches, so the service worker serves them when there's no connection.
// Kept free of imports so vite.config.ts can load it.

export const OFFLINE_CACHES = {
  tiles: 'leaflet-tiles',
  photos: 'place-photos',
  audio: 'audio-guides',
} as const;

export type OfflineCacheKind = keyof typeof OFFLINE_CACHES;
