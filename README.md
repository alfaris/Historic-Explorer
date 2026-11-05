# Cairo Walks

A walking guide (English, Arabic and French) to historic Cairo. Pick a route, browse the monuments, cafés, workshops and meeting points along it, and listen to an audio guide while you stand in front of each place.

**Live:** [cairowalks.vercel.app](https://cairowalks.vercel.app)

## Features

- **Five curated walking routes**: Ahl al-Bayt, Al-Muizz Street, Coptic Cairo, Al-Darb Al-Ahmar & the Citadel, and Fustat, Roda & Old Cairo, each with distance, walking time and highlights. Distance and walking time are stored as numbers (`distanceKm`, `hoursMin`, `hoursMax`) and written in the visitor's language ("2,5 km · 2 à 3 heures", "2.5 كم · 2–3 ساعات"). Older content with text such as "2-3 hours" is read as numbers, and the English text is still stored next to the numbers for app versions that read it. See `src/lib/route-format.ts`.
- **List and map views**: filter places by category (monuments, coffee shops, restaurants, workshops, stationery & toys, meeting points) or search by name. The map shows the route line, clustered markers and your current location, with a modern and an antique style.
- **Immersive audio guide**: Gemini rewrites each place's description as a short narrated story and voices it. If AI audio isn't available, the browser's built-in voice reads it instead.
- **Live insights**: an on-demand, Google Search–grounded summary of current visitor info and reviews for a place, with source links.
- **Near me tab**: a third tab beside List and Map that lists places by distance (this route or all routes). Once it's on, location keeps running on every tab, with a small "Near me on · Stop" pill, and arriving within about 30 m of any place offers its audio guide with a Play button (audio never starts by itself).
- **Visited tracking**: mark places as visited and see each route's progress ("6 / 14 visited"). Visited places show a check on their card and on the map. Progress is saved in the browser, so it works offline and needs no account.
- **Report a problem**: every place has a link to report a wrong location (drag a pin or send your GPS position), wrong text, a closure or a photo problem. Reports go to the admin dashboard and don't include any personal details.
- **English, Arabic and French**, with full right-to-left layout for Arabic. The language picker in the header remembers the choice; the first visit follows the browser's language. French content is optional: routes and places without French show their English (marked `lang="en"` for screen readers), and French audio is narrated in French from the English description until there is a French one. Interface strings live in `src/i18n/fr.ts`, keyed by the English text; a test fails if a component string has no French.
- **Share a route**: a **Share route** button opens the phone's share sheet, or copies the link where there's none. Links like `/r/fustat-roda` open the app on that route (`/?route=fustat-roda` works too), and show the route's photo, name and description as a preview in WhatsApp, iMessage and social apps: `vercel.json` rewrites `/r/…` to `api/share.ts`, which adds the preview tags to the app's page. In the admin, each route has a **QR code** to download or print as a card in English and Arabic (make cards from the live site's admin, since the code uses its address).
- **Search across all routes**: searching shows matches on the current route as usual, plus an **Also on other routes** list (with each place's route) that switches to the route and opens the place. Matching forgives how names are typed: Arabic vowel marks, tatweel and letter variants (أ/إ/آ/ا, ة/ه, ى/ي), and English case, accents, hyphens and apostrophes ("rifai" finds "Al-Rifa'i"). It runs on the content in the app, so it works offline. See `src/lib/search.ts`.
- **Start the walk**: a full-screen guided mode for a route. It shows the current stop with its photo and audio guide, and the next stop with the live distance and a direction arrow (it turns with the phone's compass where available, otherwise shows "NE" and so on). Arriving at the next stop moves the walk there, marks it visited and offers its audio guide; audio never plays by itself. The screen stays on (Screen Wake Lock), and with a downloaded route it all works offline. See `src/components/WalkMode.tsx` and `src/lib/walk-mode.ts`.
- **Walking directions**: each stop shows "Stop 3 of 7" and the next stop with an estimated walking time ("Next stop: Manial Palace · 10 min walk · 780 m"). Tapping it opens that stop. The stops are the route's monuments, in the order set in the admin's route editor (**Walking order**). Times come from the straight-line distance × 1.3 for winding streets at 4.5 km/h, so they work offline. See `src/lib/walk.ts`.
- **Works offline**: installable as a PWA. "Download for offline" saves a route's audio guides (in the current language), photos and map to the device, so the whole walk works with no signal. The route then shows "Available offline" with its size, offers an update when places are edited in the admin, and can be removed.

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
  components/        UI: MainContent, MapView, AudioGuide, LiveLocationInfo, RouteDownload…
  data/locations.ts  Routes, categories and places (the content lives here)
  i18n/              Interface strings (English, Arabic, French) and RTL handling
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

Audio is otherwise generated the first time a visitor plays a place, which makes that visitor wait. To generate every place in all three languages ahead of time:

```bash
vercel env pull .env.local
```

```bash
npm run pregenerate-audio
```

The first command copies `GEMINI_API_KEY` and `BLOB_READ_WRITE_TOKEN` from the Vercel project into `.env.local`. The script skips audio that's already stored for the current description and `AUDIO_VERSION`, so it's safe to run again at any time: after adding or editing places, after bumping `AUDIO_VERSION`, or to retry places that failed. It waits 2 seconds between Gemini calls to stay under rate limits.

Options: `-- --dry-run` lists what's missing without generating anything, `-- --lang=en` (or `ar`, `fr`) does one language, and `-- --delay=5000` changes the wait in milliseconds.

## Photos

Photos of the monuments and routes come from [Wikimedia Commons](https://commons.wikimedia.org) under CC BY, CC BY-SA, CC0 or public-domain licenses. They're stored as resized WebP files in `public/images/photos/`, and each one's author, license and source are in `src/data/photos.ts`. The app credits each photo on the photo itself and in the **Photo credits** dialog at the bottom of the page. Places without a photo, mostly cafés, shops and workshops, keep the illustrated placeholder.

To add or change a photo, edit `scripts/photo-sources.ts`, then run:

```bash
npm run fetch-photos
```

Each entry names either an English Wikipedia article (the article's main image is used) or a specific Commons file. The script skips photos that are already downloaded (`-- --force` re-downloads them all; `-- --only=place-1` fetches one), refuses files that aren't freely licensed, and rewrites `src/data/photos.ts`. Commit the new images and that file. `npm test` checks that every photo exists and has an author and an allowed license.

Photos aren't part of the offline install. They're cached the first time they're viewed, or when a route is downloaded for offline use.

## Offline routes

"Download for offline" (`src/components/RouteDownload.tsx`) saves everything a route needs into the service worker's own caches, so they're served with no connection:

- **Audio guides** for every stop in the current language. The URL carries a hash of the description, so an edit in the admin makes the saved copy out of date and the route offers an update. Updates download only what changed.
- **Photos** of the route and its stops.
- **Map tiles**: the route area at zoom 14–16, plus zoom 17 just around each stop, capped at 400 tiles. OpenStreetMap's tile policy forbids bulk downloads of large areas at zoom 17 and above, so don't raise these limits.

What to download is worked out in `src/lib/offline-pack.ts`, and the download itself is in `src/lib/offline-store.ts`. The list of saved routes is kept in localStorage. The cache names are shared with `vite.config.ts` through `src/lib/offline-caches.ts`.

## Admin dashboard

`/admin` is a password-protected dashboard for managing the content without a code change:

- **Reports**: visitor reports, newest first. Apply a suggested map position in one click, delete a place reported as closed, or open it in the editor. Mark reports resolved or dismissed.
  Optionally, a **daily email** lists the reports that arrived since the last one (sent around 8 am Cairo time, and only on days with new reports). To turn it on:
  1. Create a free [Resend](https://resend.com) account and an API key.
  2. In Vercel, set `RESEND_API_KEY`, `ADMIN_EMAIL` (one address, or several separated by commas) and `CRON_SECRET` (any long random string), then redeploy.
  3. Use **Send test email** on the Reports tab to check it works.

  By default, emails come from Resend's shared test address, which can only send to the email you signed up to Resend with. To send to other addresses, verify your domain in Resend and set `DIGEST_FROM`, for example `Cairo Walks <reports@yourdomain.com>`. The job is `api/_lib/digest.ts`, scheduled in `vercel.json`.
- **Places**: edit, add or delete places, including moving them by dragging a pin, and upload a photo with its credit.
  Each place shows whether its **audio guide** is ready in English, Arabic and French for the saved description. After a save that changes a description, or adds a place, the new audio is generated straight away, so visitors never wait for it. Missing audio can also be generated with one tap. Generation is admin-only, skips audio that already exists, refuses text that hasn't been saved yet, and is capped at 30 per 10 minutes.
- **French**: places and routes have optional French fields. **Fill in missing French** drafts the empty ones with Gemini: in a place or route editor it fills the form for you to check and save; on the Places list it drafts every place missing French and saves once, as one History entry you can restore. Nothing is translated on its own. See `api/_lib/translate.ts`.
- **Routes**: edit, add or delete routes and their photos (a route can only be deleted once it has no places), and set the stops' **walking order**.
- **Stats**: anonymous usage for the last 7, 30 or 90 days: audio plays, route opens and Near me arrivals, plays per day, the most-played audio guides, and for each route the plays at every stop in walking order (where visitors stop following it). Only daily totals are kept, in Blob (`stats/days/YYYY-MM-DD.json`): no cookies, visitor IDs or IP addresses. Each audio guide, route and arrival counts once per visit and is sent in one small batch. Visitors with Global Privacy Control or Do Not Track on aren't counted. See `src/lib/stats.ts`, `src/lib/track.ts` and `api/_lib/stats.ts`.
- **History**: every save is kept, and any earlier version can be restored.

To turn it on, set `ADMIN_PASSWORD` (12+ characters) in the Vercel project's environment variables and connect a Blob store. Saves go live for visitors within about a minute, with no deploy.

How it works: the routes and places are stored as one JSON document in Blob (`content/current.json`). The app starts from the copy bundled in `src/data/locations.ts`, so it renders instantly and offline, then loads `/api/content`. The audio guide, live insights and `npm run pregenerate-audio` all read the live copy, so places added in the dashboard get audio too. Every save is validated on the server with the same rules as the tests (`src/data/content.ts`), and saves use the Blob ETag so two admins can't overwrite each other's changes. The dashboard is a separate bundle (`admin.html`), so none of its code is sent to visitors.

Uploaded photos are resized in the browser (960px wide, WebP) before upload, which also strips their metadata, including any GPS position a phone saved in them. They're stored in Blob and served from `/api/photo?id=<hash>` with year-long caching. An uploaded photo replaces the built-in one for that place or route, and removing it brings the built-in one back. Each needs a credit (who took it, and a license such as "Own photo" or "CC BY-SA 4.0"), shown on the photo and in **Photo credits**.

## Adding or editing places

Once the admin dashboard has saved, the live content is the copy in Blob, and edits should go through the dashboard. `src/data/locations.ts` is the starting content and the fallback. Every route, category and place is defined there. Each place needs an `id`, a `routeId`, English and Arabic names and descriptions, a `category` and coordinates. The audio guide and live insights work for new places automatically. Run `npm test` afterwards: it checks that every place has a valid route and category, text in both languages, and coordinates inside Cairo.
