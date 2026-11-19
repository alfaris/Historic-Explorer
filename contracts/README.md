# Contracts

Files the website and the native apps (Cairo Walks, Android and iOS) share, so they behave the same.

- `content-v1.schema.json`: the JSON Schema of `GET /api/v1/content`, generated from the TypeScript types (`Content` in `src/data/content.ts`, `ContentV1` in `api/_lib/content-v1.ts`). The apps' Kotlin models are generated from it. After changing those types, run `npm run gen:schema`; a test fails while the file is out of date, and another checks real responses against it.
  - The schema allows extra properties: while `schemaVersion` is 1, the content only gains fields, and the apps decode leniently (ignore what they don't know).
  - Audio URLs (`audio`) are relative to the API's origin; use them as they are.
