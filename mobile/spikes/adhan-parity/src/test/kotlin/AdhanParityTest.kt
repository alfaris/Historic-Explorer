import com.batoulapps.adhan2.CalculationMethod
import com.batoulapps.adhan2.Coordinates
import com.batoulapps.adhan2.PrayerTimes
import com.batoulapps.adhan2.data.DateComponents
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.long
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Every prayer and sun time the web computes (contracts/vectors), recomputed with adhan2, to the minute. */
class AdhanParityTest {
    @Test
    fun matchesTheWebToTheMinute() {
        val root = Json.parseToJsonElement(File(System.getProperty("vectors")).readText()).jsonObject
        val place = root["place"]!!.jsonObject
        val coordinates = Coordinates(place["lat"]!!.jsonPrimitive.double, place["lng"]!!.jsonPrimitive.double)
        val params = CalculationMethod.EGYPTIAN.parameters
        val fields = root["fields"]!!.jsonArray.map { it.jsonPrimitive.content }.drop(1)
        val days = root["days"]!!.jsonArray

        val mismatches = mutableListOf<String>()
        var compared = 0
        for (row in days) {
            val cells = row.jsonArray
            val (y, m, d) = cells[0].jsonPrimitive.content.split("-").map { it.toInt() }
            val t = PrayerTimes(coordinates, DateComponents(y, m, d), params)
            // adhan2 has no public sunset. Maghrib is sunset plus the method's maghrib
            // adjustment, which is 0 for the Egyptian method, so sunset is maghrib (the
            // web's vectors check the same: sunset equals maghrib on every day).
            val ours = mapOf(
                "fajr" to t.fajr, "sunrise" to t.sunrise, "dhuhr" to t.dhuhr, "asr" to t.asr,
                "sunset" to t.maghrib, "maghrib" to t.maghrib, "isha" to t.isha,
            )
            fields.forEachIndexed { i, name ->
                // Exact milliseconds: a time with seconds would be a difference too, not rounded away.
                val expected = cells[i + 1].jsonPrimitive.long * 60_000
                val actual = ours.getValue(name).toEpochMilliseconds()
                compared++
                if (actual != expected) mismatches += "${cells[0].jsonPrimitive.content} $name: web $expected ms, adhan2 $actual ms (${(actual - expected) / 1000.0} s)"
            }
        }
        println("Compared $compared times over ${days.size} days; ${mismatches.size} differ.")
        mismatches.take(20).forEach(::println)
        assertTrue(compared == days.size * fields.size)
        assertEquals(emptyList(), mismatches)
    }
}
