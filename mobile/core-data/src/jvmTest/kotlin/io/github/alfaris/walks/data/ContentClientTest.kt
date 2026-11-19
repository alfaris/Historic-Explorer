package io.github.alfaris.walks.data

import io.github.alfaris.walks.model.ContentJson
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject

class ContentClientTest {
    private val sample = ContentJson.parseToJsonElement(File(System.getProperty("contracts"), "vectors/content-v1-sample.json").readText())
        .jsonObject["response"].toString()
    private val etag = "\"abc\""

    private fun client(appVersion: Int = 1, body: String = sample) = ContentClient(
        HttpClient(MockEngine { request ->
            if (request.headers[HttpHeaders.IfNoneMatch] == etag) respond("", HttpStatusCode.NotModified)
            else respond(body, HttpStatusCode.OK, headersOf(HttpHeaders.ETag, etag))
        }),
        "https://example.test/api/v1/content",
        appVersion,
    )

    @Test
    fun readsContentAndItsEtag() = runTest {
        val result = assertIs<ContentResult.Fresh>(client().fetch())
        assertEquals(3, result.content.content.places.size)
        assertEquals(etag, result.etag)
    }

    @Test
    fun anUnchangedVersionIsA304() = runTest {
        assertEquals(ContentResult.NotModified, client().fetch(lastEtag = etag))
    }

    @Test
    fun anOldAppIsToldToUpdate() = runTest {
        val newer = sample.replace("\"minAppVersion\":1", "\"minAppVersion\":7")
        assertEquals(ContentResult.UpdateRequired(7), client(appVersion = 3, body = newer).fetch())
    }
}
