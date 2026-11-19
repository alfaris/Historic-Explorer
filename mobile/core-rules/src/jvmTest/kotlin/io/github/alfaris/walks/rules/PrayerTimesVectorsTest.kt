package io.github.alfaris.walks.rules

import io.github.alfaris.walks.city.Cities
import io.github.alfaris.walks.model.ContentJson
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long

/**
 * The app's prayer and sun times, computed with the app's own city settings, against
 * contracts/vectors/prayer-times-cairo.json (the web's), to the millisecond. The
 * settings must equal the ones the vectors were made with, so a change on either
 * side fails here.
 */
class PrayerTimesVectorsTest {
    private val vectors = ContentJson.parseToJsonElement(File(System.getProperty("contracts"), "vectors/prayer-times-cairo.json").readText()).jsonObject
    private val city = Cities.CAIRO

    @Test
    fun theAppsSettingsAreTheWebs() {
        val place = vectors["place"]!!.jsonObject
        assertEquals(place["lat"]!!.jsonPrimitive.double, city.prayerPlace.lat)
        assertEquals(place["lng"]!!.jsonPrimitive.double, city.prayerPlace.lng)
        assertEquals(vectors["method"]!!.jsonPrimitive.content.uppercase(), city.prayerMethod.name)
        assertEquals(vectors["goldenMinutes"]!!.jsonPrimitive.int, city.goldenMinutes)
    }

    @Test
    fun matchesTheWeb() {
        val fields = vectors["fields"]!!.jsonArray.map { it.jsonPrimitive.content }.drop(1)
        val mismatches = mutableListOf<String>()
        var compared = 0
        for (row in vectors["days"]!!.jsonArray) {
            val cells = row.jsonArray
            val date = LocalDate.parse(cells[0].jsonPrimitive.content)
            val t = dayTimes(city, date)
            val ours = mapOf("fajr" to t.fajr, "sunrise" to t.sunrise, "dhuhr" to t.dhuhr, "asr" to t.asr, "sunset" to t.sunset, "maghrib" to t.maghrib, "isha" to t.isha)
            fields.forEachIndexed { i, name ->
                val expected = cells[i + 1].jsonPrimitive.long * 60_000
                val actual = ours.getValue(name).toEpochMilliseconds()
                compared++
                if (actual != expected) mismatches += "$date $name: web $expected ms, app $actual ms"
            }
        }
        println("Prayer times: compared $compared over ${vectors["days"]!!.jsonArray.size} days; ${mismatches.size} differ.")
        mismatches.take(20).forEach(::println)
        assertEquals(7672, compared)
        assertEquals(emptyList(), mismatches)
    }
}
