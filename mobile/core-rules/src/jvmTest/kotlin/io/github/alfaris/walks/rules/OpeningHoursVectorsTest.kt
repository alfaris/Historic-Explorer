package io.github.alfaris.walks.rules

import io.github.alfaris.walks.city.Cities
import io.github.alfaris.walks.model.ContentJson
import io.github.alfaris.walks.model.OpeningHours
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Every case in contracts/vectors/opening-hours.json, computed by the port, in the city's own time zone. */
class OpeningHoursVectorsTest {
    private val vectors = ContentJson.parseToJsonElement(File(System.getProperty("contracts"), "vectors/opening-hours.json").readText()).jsonObject
    private val zone = TimeZone.of(Cities.CAIRO.timeZone)
    private val hours: Map<String, OpeningHours> =
        vectors["hours"]!!.jsonObject.mapValues { ContentJson.decodeFromJsonElement(OpeningHours.serializer(), it.value) }

    private fun encode(status: OpenStatus?): JsonElement = when (status) {
        null -> JsonNull
        is OpenStatus.Open -> json("open" to true, "closes" to status.closes)
        is OpenStatus.Closed -> json("open" to false, "opens" to status.opens)
    }

    private fun json(open: Pair<String, Boolean>, change: Pair<String, When?>): JsonObject =
        ContentJson.parseToJsonElement(
            """{"open":${open.second},"${change.first}":${change.second?.let { """{"inDays":${it.inDays},"minutes":${it.minutes}}""" } ?: "null"}}""",
        ).jsonObject

    @Test
    fun matchesTheWeb() {
        val mismatches = mutableListOf<String>()
        var statuses = 0
        var times = 0
        for (case in vectors["cases"]!!.jsonArrayOrEmpty()) {
            val c = case.jsonObject
            val at = Instant.parse(c["at"]!!.jsonPrimitive.content)
            if ("cairo" in c) {
                val expected = c["cairo"]!!.jsonObject
                val ours = cityTime(at, zone)
                times++
                if (ours.day != expected["day"]!!.jsonPrimitive.int || ours.minutes != expected["minutes"]!!.jsonPrimitive.int) mismatches += "${c["at"]} time: $ours vs $expected"
            } else {
                val name = c["hours"]!!.jsonPrimitive.content
                val ours = encode(openStatus(hours.getValue(name), at, zone))
                statuses++
                if (ours != c["status"]) mismatches += "${c["at"]} $name: $ours vs ${c["status"]}"
            }
        }
        println("Opening hours: $statuses statuses and $times Cairo times compared; ${mismatches.size} differ.")
        mismatches.take(20).forEach(::println)
        assertTrue(statuses > 200 && times > 30)
        assertEquals(emptyList(), mismatches)
    }

    @Test
    fun skipsAMalformedRangeInsteadOfFailing() {
        val bad = io.github.alfaris.walks.model.TimeRange(open = "9am", close = "17:00")
        val good = io.github.alfaris.walks.model.TimeRange(open = "09:00", close = "17:00")
        val hours = OpeningHours(days = List(7) { listOf(bad, io.github.alfaris.walks.model.TimeRange("9:00", "x"), good) })
        // Sunday 2026-01-04 10:00 in Cairo: open until 17:00 by the good range alone.
        assertEquals(OpenStatus.Open(When(0, 17 * 60)), openStatus(hours, Instant.parse("2026-01-04T08:00:00Z"), zone))
        val onlyBad = OpeningHours(days = List(7) { listOf(bad) })
        assertEquals(OpenStatus.Closed(null), openStatus(onlyBad, Instant.parse("2026-01-04T08:00:00Z"), zone))
    }

    @Test
    fun noHoursIsUnknown() {
        assertEquals(null, openStatus(null, Instant.parse("2026-01-04T10:00:00Z"), zone))
        assertTrue(encode(null) is JsonNull)
        assertTrue(json("open" to true, "closes" to null)["open"]!!.jsonPrimitive.boolean)
    }
}

private fun JsonElement.jsonArrayOrEmpty() = (this as? kotlinx.serialization.json.JsonArray) ?: emptyList()
