package io.github.alfaris.walks.model

import io.github.alfaris.walks.city.Cities
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** The generated models read what the server sends, by the decoding rules in contracts/README.md. */
class DecodingTest {
    private val contracts = File(System.getProperty("contracts"))
    private val sampleText: String =
        Json.parseToJsonElement(contracts.resolve("vectors/content-v1-sample.json").readText()).jsonObject["response"].toString()

    @Test
    fun readsTheServersResponse() {
        val v1 = decodeContent(sampleText)
        assertEquals(1, v1.schemaVersion)
        assertEquals(3, v1.content.places.size)
        val first = v1.content.places.first()
        assertEquals(1, first.id) // an Int, not 1.0
        assertEquals(EraId.FATIMID, first.era)
        assertEquals(1125, first.builtFrom)
        assertEquals(PhotoRule.NO_FLASH, first.tips?.photos)
        assertEquals(7, first.hours?.days?.size)
        assertNotNull(v1.content.places[1].gallery?.single())
        assertTrue(v1.content.glossary!!.isNotEmpty()) // always sent, the built-in one until the admin saves one
        // Both kinds of special-period entry, in one class.
        val entries = v1.content.specialPeriods!!.single().places
        assertEquals(true, entries["2"]?.closed)
        assertNull(entries["1"]?.closed)
        assertEquals("10:00", entries["1"]?.days?.first()?.first()?.open)
        // Audio URLs keyed by place ID as a string.
        assertTrue(v1.audio["1"]?.en!!.startsWith("/api/audio-guide?id=1&lang=en&v="))
    }

    @Test
    fun takesAdditionsInItsStride() {
        // A later server adds fields and a new category: an installed app keeps working.
        val sample = Json.parseToJsonElement(sampleText).jsonObject
        val text = sampleText
            .replaceFirst("\"category\":\"monument\"", "\"category\":\"museum\"")
            .replaceFirst("\"schemaVersion\":1", "\"schemaVersion\":1,\"somethingNew\":{\"a\":[1,2]}")
            .replaceFirst("\"nameEn\":", "\"newField\":\"x\",\"nameEn\":")
        assertTrue(text != sampleText && sample is JsonObject)
        val v1 = decodeContent(text)
        assertEquals("museum", v1.content.places.first { it.id == 1 }.category)
    }

    @Test
    fun cairoIsConfiguredLikeTheWeb() {
        val city = Cities.CAIRO
        assertEquals("io.github.alfaris.walks.cairo", city.applicationId)
        assertEquals("Africa/Cairo", city.timeZone)
        assertTrue(city.contentUrl.startsWith("https://") && city.contentUrl.endsWith("/api/v1/content"))
    }
}
