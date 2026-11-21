package io.github.alfaris.walks.city

/**
 * Everything that makes the app one city's: Cairo Walks now, other cities later as
 * separate apps (Android flavors) on the same code. Nothing city-specific belongs
 * anywhere else.
 */
data class CityConfig(
    /** The app's name, as shown under its icon. */
    val appName: String,
    /** The Play Store application ID (fixed once published) and iOS bundle ID. */
    val applicationId: String,
    /** The IANA time zone the city's hours, prayers and dates are in. */
    val timeZone: String,
    /** Where prayer times are computed for (the web's PRAYER_PLACE), and with which method. */
    val prayerPlace: LatLng,
    val prayerMethod: PrayerMethod,
    /** Minutes of golden light after sunrise and before sunset (the web's GOLDEN_MINUTES). */
    val goldenMinutes: Int,
    /** The map's bounds: south-west and north-east corners. */
    val bounds: Pair<LatLng, LatLng>,
    /** The content API (GET returns ContentV1). */
    val contentUrl: String,
    /** Offline map tiles (PMTiles); null until they are hosted (#252). */
    val tilesUrl: String?,
    /** Brand colours as 0xAARRGGBB. */
    val colors: Colors,
) {
    data class LatLng(val lat: Double, val lng: Double)
    data class Colors(val primary: Long, val accent: Long, val background: Long)
    enum class PrayerMethod { EGYPTIAN }
}

object Cities {
    val CAIRO = CityConfig(
        appName = "Cairo Walks",
        applicationId = "io.github.alfaris.walks.cairo",
        timeZone = "Africa/Cairo",
        prayerPlace = CityConfig.LatLng(30.0444, 31.2357),
        prayerMethod = CityConfig.PrayerMethod.EGYPTIAN,
        goldenMinutes = 60,
        bounds = CityConfig.LatLng(29.98, 31.20) to CityConfig.LatLng(30.08, 31.30),
        contentUrl = "https://cairowalks.vercel.app/api/v1/content",
        tilesUrl = null,
        colors = CityConfig.Colors(primary = 0xFF1A4D3B, accent = 0xFFC5A059, background = 0xFFF8F7F4), // the web's nile, gold and chalk
    )
}
