import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { OFFLINE_CACHES } from './src/lib/offline-caches';

// Serves the Vercel functions in api/ during `npm run dev`, so Gemini calls
// stay server-side locally too.
const devApi = (): Plugin => ({
  name: 'dev-api',
  // /admin serves the admin page (Vercel does the same with a rewrite).
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/admin' || req.url?.startsWith('/admin?')) req.url = '/admin.html';
      next();
    });
  },
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/admin' || req.url?.startsWith('/admin?')) req.url = '/admin.html';
      next();
    });
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const routes: Record<string, [string, string]> = {
        '/api/audio-guide': ['/api/_lib/gemini.ts', 'handleAudioGuide'],
        '/api/live-info': ['/api/_lib/gemini.ts', 'handleLiveInfo'],
        '/api/content': ['/api/content.ts', 'default'],
        '/api/report': ['/api/_lib/reports.ts', 'handleReport'],
        '/api/admin': ['/api/_lib/admin.ts', 'handleAdmin'],
        '/api/photo': ['/api/_lib/photos.ts', 'handlePhotoServe'],
      };
      const route = routes[url.pathname];
      if (!route) return next();
      try {
        const mod = await server.ssrLoadModule(route[0]);
        const handler = route[1] === 'default' ? (r: Request) => mod.default.fetch(r) : mod[route[1]];
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(key, value);
        }
        headers.set('x-real-ip', req.socket.remoteAddress ?? 'local');
        const method = req.method ?? 'GET';
        let body: Buffer | undefined;
        if (method !== 'GET' && method !== 'HEAD') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          body = Buffer.concat(chunks);
        }
        const fullUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const response: Response = await handler(new Request(fullUrl, { method, headers, body }));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        next(err);
      }
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Only the dev server process sees the key; it is never inlined into client code.
  process.env.GEMINI_API_KEY ??= env.GEMINI_API_KEY;
  return {
    plugins: [
      react(), 
      devApi(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Cairo Historic Explorer',
          short_name: 'CairoExplorer',
          description: 'Discover the monuments and life of historic streets',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          // The admin dashboard isn't part of the visitor app: don't make every
          // visitor download it, and never answer /admin or /api with the app.
          globIgnores: ['**/admin.html', '**/assets/admin-*'],
          navigateFallbackDenylist: [/^\/admin/, /^\/api\//],
          runtimeCaching: [
            {
              // Live routes and places: always try the network first (admin
              // edits show up), and fall back to the last copy offline.
              urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === '/api/content',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'content',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 1 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                // Also filled by "Download for offline" (src/lib/offline-store.ts),
                // so the limits leave room for several saved routes.
                cacheName: OFFLINE_CACHES.tiles,
                expiration: {
                  maxEntries: 3000,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Place photos (built-in and uploaded): cached the first time
              // they're seen (or when a route is downloaded), not precached.
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && (url.pathname.startsWith('/images/photos/') || url.pathname === '/api/photo'),
              handler: 'CacheFirst',
              options: {
                cacheName: OFFLINE_CACHES.photos,
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Google Fonts: the stylesheet, then the font files it points to,
              // so headings keep their typeface offline.
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 4 } },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Audio guides. Only versioned URLs (?v=<hash of the text>) are
              // cached, and only real recordings, not the text-only fallback.
              // An edited description gets a new URL, so old copies just age out.
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && url.pathname === '/api/audio-guide' && url.searchParams.has('v'),
              handler: 'CacheFirst',
              options: {
                cacheName: OFFLINE_CACHES.audio,
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [200], headers: { 'Content-Type': 'audio/wav' } },
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        // Two pages: the visitor app and the admin dashboard (its own bundle).
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
        output: {
          // Libraries that rarely change get their own file, so browsers keep
          // them cached when only the app's code changes between deploys.
          manualChunks(id) {
            if (/node_modules\/(react|react-dom|scheduler|motion|motion-dom|motion-utils|framer-motion)\//.test(id)) {
              return 'vendor';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
