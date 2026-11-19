package io.github.alfaris.walks.rules

import com.batoulapps.adhan2.CalculationMethod
import com.batoulapps.adhan2.Coordinates
import com.batoulapps.adhan2.PrayerTimes
import com.batoulapps.adhan2.data.DateComponents
import io.github.alfaris.walks.city.CityConfig
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate

/** A day's prayer and sun times in the city, as the web computes them (adhan, the city's method). */
data class DayTimes(
    val fajr: Instant,
    val sunrise: Instant,
    val dhuhr: Instant,
    val asr: Instant,
    /** adhan2 has no public sunset; with the Egyptian method maghrib is sunset (no maghrib adjustment). */
    val sunset: Instant,
    val maghrib: Instant,
    val isha: Instant,
)

fun dayTimes(city: CityConfig, date: LocalDate): DayTimes {
    val params = when (city.prayerMethod) {
        CityConfig.PrayerMethod.EGYPTIAN -> CalculationMethod.EGYPTIAN.parameters
    }
    val t = PrayerTimes(Coordinates(city.prayerPlace.lat, city.prayerPlace.lng), DateComponents(date.year, date.monthNumber, date.dayOfMonth), params)
    return DayTimes(t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.maghrib, t.isha)
}
