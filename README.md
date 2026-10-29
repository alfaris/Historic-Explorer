# Cairo Walks

A bilingual (English / Arabic) walking guide to historic Cairo. Pick a route, browse the monuments, cafés, workshops and meeting points along it, and listen to an audio guide while you stand in front of each place.

**Live:** [cairowalks.vercel.app](https://cairowalks.vercel.app)

## Features

- **Four curated walking routes**: Ahl al-Bayt, Al-Muizz Street, Coptic Cairo, and Al-Darb Al-Ahmar & the Citadel, each with distance, duration and highlights.
- **List and map views**: filter places by category (monuments, coffee shops, restaurants, workshops, stationery & toys, meeting points) or search by name. The map shows the route line, clustered markers and your current location, with a modern and an antique style.
- **Immersive audio guide**: Gemini rewrites each place's description as a short narrated story and voices it. If AI audio isn't available, the browser's built-in voice reads it instead.
- **Live insights**: an on-demand, Google Search–grounded summary of current visitor info and reviews for a place, with source links.
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

Other scripts: `npm run build` (production build in `dist/`), `npm run preview`, `npm run lint` (type check).

## Deploying

The app deploys to Vercel from this repository. Set `GEMINI_API_KEY` in the Vercel project's environment variables. Only the functions in `api/` read it, and it is not included in the frontend build.

For persistent audio, create a **private** Blob store under the project's Storage tab and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`. Without it, the app still works, but audio is regenerated after each deploy.

## Adding or editing places

Every route, category and place is defined in `src/data/locations.ts`. Each place needs an `id`, a `routeId`, English and Arabic names and descriptions, a `category` and coordinates. The audio guide and live insights work for new places automatically.
