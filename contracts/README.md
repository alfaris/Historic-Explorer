# Contracts

Files the website and the native apps (Cairo Walks, Android and iOS) share, so they behave the same.

- `content-v1.schema.json`: the JSON Schema of `GET /api/v1/content`, generated from the TypeScript types (`Content` in `src/data/content.ts`, `ContentV1` in `api/_lib/content-v1.ts`). The apps' Kotlin models are generated from it. After changing those types, run `npm run gen:schema`; a test fails while the file is out of date, and another checks real responses against it.
  - The schema allows extra properties: while `schemaVersion` is 1, the content only gains fields, and the apps decode leniently (ignore what they don't know).
  - Audio URLs (`audio`) are relative to the API's origin; use them as they are.

- `vectors/*.json`: golden vectors, the web's own inputs and outputs for the visitor logic the apps port. They are generated from `src/lib` by `npm run gen:vectors` (`scripts/export-vectors.ts`, one module per area in `scripts/vectors/`), and a test fails while any of them is out of date, in each of the four time zones CI runs. Each file has `about` (what it covers and how to read it), its inputs, then `cases`, one per line. They record semantic values only: instants (UTC, ISO 8601), minutes, IDs, enums and states. Formatted text ("45 m", "9:00 am") differs by platform and isn't in them.
  - `opening-hours`, `special-hours`, `open-now`: whether a place is open, across midnight, the week's wrap and Egypt's DST changes.
  - `walk-pace`, `geo`, `nearby`: walking times, distances, arrival on GPS fixes, and nearby places.
  - `notices`, `quiz`, `passport`: which notices show, the quiz (with the random numbers each game drew), best scores, and stamps.
  - `id-set-store`, `visit-dates`: operation sequences for the device stores, including failed writes, other tabs' changes and retries.
- `vectors/prayer-times-cairo.json`: the web's prayer and sun times for every Cairo day from 2026 to 2028, as minutes since the Unix epoch. The apps' prayer times are checked against it to the minute (see `mobile/spikes/adhan-parity`). Regenerate it with `npm run gen:vectors`; a test fails while it's out of date.

## Decoding rules for the apps

While `schemaVersion` is 1 the server only adds; these rules make an addition safe for app builds already installed.

- **Unknown fields:** ignore them (`ignoreUnknownKeys = true` in kotlinx.serialization). This matches `additionalProperties: true` in the schema.
- **Unknown enum values:** a new category, era, photo rule or access value is an addition, not a break. Decode enums leniently: an unknown value becomes null, or a default (`coerceInputValues` with a default, or a custom serializer). Never let one unknown value drop a place or the whole response. A change an old app can't survive needs `minAppVersion` raised instead.
- **Integers:** fields typed `integer` (place IDs, years, minutes, photo sizes, the versions) decode to `Int`. Everything else that is a `number` (`lat`, `lng`, `distanceKm`, `hoursMin`, `hoursMax`) decodes to `Double`. The server leaves out anything an app couldn't decode, by the limits the admin's validation already sets (a restored old version could still hold one): photos not 1–4000 whole pixels, build years outside 1–2100, metro minutes outside 1–60, and a route start (`startId`) that isn't one of the places sent. So an integer field never arrives fractional or too large for `Int`.
- **Maps keyed by place ID:** `audio` and `SpecialPeriod.places` are keyed by the place ID as a string (`"12"`), as JSON keys are.
- **Special-period entries** (`PeriodEntry`) are either `{ "closed": true }` or `{ "days": [...] }`, with no type tag. Decode them as one class with an optional `closed` and an optional `days` (or a sealed class with a small custom serializer that looks at which key is present).
- **What the server fills in:** `glossary` is always sent: the built-in one until the admin saves their own. `help` is sent only once the admin has saved it, and the emergency numbers are never in the content. Like the web, the apps keep their own built-in Help (emergency numbers, tips, phrases) and add the admin's `help` entries (local contacts, extra tips, extra phrases) to it when present; never replace the built-in Help with them (see `src/lib/help-content.ts`).
- **Admin-only fields:** `drafted` (on routes, places, notices, special periods, glossary terms and Help entries) and `pinChecked` (on places) are for the admin dashboard. The apps ignore them.
