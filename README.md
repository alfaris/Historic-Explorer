# Cairo Walks

A bilingual (English / Arabic) walking guide to historic Cairo. Pick a route, browse the monuments, cafés, workshops and meeting points along it, and listen to an audio guide while you stand in front of each place.

**Live:** [cairowalks.vercel.app](https://cairowalks.vercel.app)

## Features

- **Five curated walking routes**: Ahl al-Bayt, Al-Muizz Street, Coptic Cairo, Al-Darb Al-Ahmar & the Citadel, and Fustat, Roda & Old Cairo, each with distance, duration and highlights.
- **List and map views**: filter places by category (monuments, coffee shops, restaurants, workshops, stationery & toys, meeting points) or search by name. The map shows the route line, clustered markers and your current location, with a modern and an antique style.
- **Immersive audio guide**: Gemini rewrites each place's description as a short narrated story and voices it. If AI audio isn't available, the browser's built-in voice reads it instead.
- **Live insights**: an on-demand, Google Search–grounded summary of current visitor info and reviews for a place, with source links.
- **Near me**: shows the nearest place on the route and its distance as you walk. When you arrive within about 30 m of a place, it offers that place's audio guide with a Play button (audio never starts by itself). Location is only watched while the mode is on.
- **Visited tracking**: mark places as visited and see each route's progress ("6 / 14 visited"). Visited places show a check on their card and on the map. Progress is saved in the browser, so it works offline and needs no account.
- **English and Arabic**, with full right-to-left layout.
- **Works offline**: installable as a PWA. "Download map" saves a route's map tiles to the device for use without a connection.

## Tech stack

- React 19, TypeScript, Vite, Tailwind CSS 4, Motion
- Leaflet / React Leaflet with OpenStreetMap tiles
- Google Gemini (`@google/genai`), called only from server-side functions
- `vite-plugin-pwa` / Workbox for offline support
- Hosted on Vercel (static frontend and functions in `api/`)

## Project structure

```
api/
  _lib/gemini.ts     Gemini calls (script, text-to-speech, live insights). Server only.
  audio-guide.ts     GET /api/audio-guide?id=<locationId>&lang=en|ar  → audio/wav
  live-info.ts       GET /api/live-info?id=<locationId>&lang=en|ar    → JSON
src/
  components/        UI: MainContent, MapView, AudioGuide, LiveLocationInfo, OfflineManager…
  data/locations.ts  Routes, categories and places (the content lives here)
  i18n/              English/Arabic strings and RTL handling
```

The browser never receives the Gemini API key. It requests audio and insights by location ID, and the server builds the prompts from `src/data/locations.ts`. Generated audio is stored in Vercel Blob (keyed by the description text), so each place is generated once and survives deploys. Editing a description regenerates its audio automatically, and bumping `AUDIO_VERSION` in `api/_lib/gemini.ts` regenerates everything, for example after changing the voice or prompt.

### Keeping Gemini costs bounded

The API is public, so it limits how often Gemini can be called:

- **Strict queries.** The endpoints accept only `?id=<number>&lang=en|ar`. Any other parameter gets a `400`, so made-up URLs can't get around the CDN cache. Unknown places get a `404`. Neither ever calls Gemini.
- **Cached results.** Audio is generated once per place and language and kept in Blob, as described above. Live insights are kept in Blob for 24 hours (`LIVE_INFO_TTL_MS`), so each place and language costs at most one search-grounded Gemini call per day. Requests that arrive at the same time share a single call.
- **Failure cooldown.** If a Gemini call fails, repeat requests for that place get the same error for 60 seconds instead of retrying immediately.
- **Rate limit.** Each IP gets 40 API requests per minute per function instance, after which it receives a `429` with `Retry-After`. Responses served from the CDN cache don't count toward the limit. For a hard limit across all instances, also add a Vercel Firewall rate-limit rule on `/api/*`.

Because there are only a fixed number of places, there is a ceiling on Gemini usage. With a Blob store connected, it is roughly two calls per place and language for audio (whenever a description or `AUDIO_VERSION` changes) plus one live-insights call per place and language per day.

## Running locally

Requires Node.js 20+.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with your [Gemini API key](https://aistudio.google.com/apikey):
   ```bash
   GEMINI_API_KEY=your-key
   ```
3. Start the dev server at http://localhost:3000 (it also serves `/api/*`):
   ```bash
   npm run dev
   ```

Other scripts: `npm run build` (production build in `dist/`), `npm run preview`, `npm run lint` (type check), `npm test` (checks the routes and places in `src/data/locations.ts`), `npm run pregenerate-audio` (see [Pre-generating the audio guides](#pre-generating-the-audio-guides)), `npm run fetch-photos` (see [Photos](#photos)).

Every pull request runs the type check, the tests and a production build on GitHub Actions (`.github/workflows/ci.yml`).

## Deploying

The app deploys to Vercel from this repository. Set `GEMINI_API_KEY` in the Vercel project's environment variables. Only the functions in `api/` read it, and it is not included in the frontend build.

For persistent audio, create a **private** Blob store under the project's Storage tab and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`. Without it, the app still works, but audio is regenerated after each deploy.

### Pre-generating the audio guides

Audio is otherwise generated the first time a visitor plays a place, which makes that visitor wait. To generate every place in both languages ahead of time:

```bash
vercel env pull .env.local
```

```bash
npm run pregenerate-audio
```

The first command copies `GEMINI_API_KEY` and `BLOB_READ_WRITE_TOKEN` from the Vercel project into `.env.local`. The script skips audio that's already stored for the current description and `AUDIO_VERSION`, so it's safe to run again at any time: after adding or editing places, after bumping `AUDIO_VERSION`, or to retry places that failed. It waits 2 seconds between Gemini calls to stay under rate limits.

Options: `-- --dry-run` lists what's missing without generating anything, `-- --lang=en` (or `ar`) does one language, and `-- --delay=5000` changes the wait in milliseconds.

## Photos

Photos of the monuments and routes come from [Wikimedia Commons](https://commons.wikimedia.org) under CC BY, CC BY-SA, CC0 or public-domain licenses. They're stored as resized WebP files in `public/images/photos/`, and each one's author, license and source are in `src/data/photos.ts`. The app credits each photo on the photo itself and in the **Photo credits** dialog at the bottom of the page. Places without a photo, mostly cafés, shops and workshops, keep the illustrated placeholder.

To add or change a photo, edit `scripts/photo-sources.ts`, then run:

```bash
npm run fetch-photos
```

Each entry names either an English Wikipedia article (the article's main image is used) or a specific Commons file. The script skips photos that are already downloaded (`-- --force` re-downloads them all; `-- --only=place-1` fetches one), refuses files that aren't freely licensed, and rewrites `src/data/photos.ts`. Commit the new images and that file. `npm test` checks that every photo exists and has an author and an allowed license.

Photos aren't part of the offline install. They're cached the first time they're viewed, or when a route's map is downloaded.

## Adding or editing places

Every route, category and place is defined in `src/data/locations.ts`. Each place needs an `id`, a `routeId`, English and Arabic names and descriptions, a `category` and coordinates. The audio guide and live insights work for new places automatically. Run `npm test` afterwards: it checks that every place has a valid route and category, text in both languages, and coordinates inside Cairo.
