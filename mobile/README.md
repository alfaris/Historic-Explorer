# Cairo Walks apps

The native apps, built with Kotlin Multiplatform: shared logic in Kotlin, Android in Jetpack Compose, iOS in SwiftUI (from M2). Each city is its own app on the same code; only its `CityConfig` differs.

## Modules

| Module | What it holds |
| --- | --- |
| `core-model` | The content models, **generated** from `contracts/content-v1.schema.json` by `npm run gen:models` (don't edit `ContentV1.kt` by hand), and `CityConfig` with `Cities.CAIRO`. |
| `core-rules` | Logic ported from the web's `src/lib`, checked against the web's golden vectors in `contracts/vectors`: opening hours so far, and prayer and sun times with adhan2. |
| `core-data` | `ContentClient`: reads `/api/v1/content` with its ETag (a 304 when unchanged) and checks `minAppVersion`. Storing content (SQLDelight) comes in M1. |
| `androidApp` | The Android app: one flavor per city (`cairo`: `io.github.alfaris.walks.cairo`, minimum Android 8). For now one screen that reads the live content and counts it. |

The shared modules target the JVM (which Android uses) and iOS (`iosArm64`, `iosSimulatorArm64`, `iosX64`).

## Building

```
./gradlew check                          # every test, including the golden vectors
./gradlew :androidApp:assembleCairoDebug # the debug APK
```

- Android needs the Android SDK: set `ANDROID_HOME`, or `sdk.dir` in `local.properties`. Without one, `androidApp` is left out and the shared modules still build and test.
- iOS targets compile on macOS only. CI's `Mobile (iOS)` workflow compiles them whenever `mobile/` or `contracts/` changes.
- CI's `mobile` job runs `check`, builds the debug APK and keeps it as a download for 14 days.

## Rules

- **The web is the reference.** A port in `core-rules` is checked case by case against `contracts/vectors`. If the web changes, its vectors change (`npm run gen:vectors`), and the port must follow before CI goes green.
- **City constants live in `CityConfig` only.** Tests assert that Cairo's prayer place, method and golden-hour length equal the values the vectors were made with, and that the flavor's application ID equals `CityConfig`'s.
- **Decoding follows `contracts/README.md`.** Unknown fields are ignored and enums are plain strings, so content additions never break an installed app.
