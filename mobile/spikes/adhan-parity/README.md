# Spike: prayer times in Kotlin (#254)

**Question:** does a Kotlin Multiplatform library give the same prayer times as the web, to the minute?

**Answer: yes.** [adhan2](https://github.com/batoulapps/adhan-kotlin) 0.0.5 (`com.batoulapps.adhan:adhan2`, the Kotlin Multiplatform port of adhan by the authors of adhan-js) matches adhan-js 4.4.3 on all 7,672 values. That is 1,096 Cairo days from 2026 to 2028, by 7 times a day: fajr, sunrise, dhuhr, asr, sunset, maghrib and isha. The golden hours come from sunrise and sunset. So the apps use adhan2 and no hand-written port is needed.

**How the apps call it.** Use the same settings as the web (`src/lib/prayer-times.ts`):
- the coordinates 30.0444, 31.2357;
- `CalculationMethod.EGYPTIAN.parameters`;
- the Cairo calendar date as `DateComponents(year, month, day)`.

The results are instants. Show them in Africa/Cairo time, whatever the phone's time zone.

**One difference.** adhan2 has no public `sunset`. Maghrib is sunset plus the method's maghrib adjustment, which is 0 for the Egyptian method, so the apps use maghrib as sunset. The web's vector test checks that sunset equals maghrib on every day. If the method or its adjustments ever change, that test fails first.

**The check.**
- `npm run gen:vectors` exports the web's times to `contracts/vectors/prayer-times-cairo.json`, and a vitest test keeps that file up to date. It also checks that the times come out the same whatever time zone the web runs in.
- `gradle -p mobile/spikes/adhan-parity test` recomputes every value with adhan2 and fails on any difference of a minute or more.
- CI runs both: the `check` job for the vectors and the `mobile-parity` job for the Kotlin test.

When the app skeleton (#253) exists, this test moves into the shared module, and this folder goes.
