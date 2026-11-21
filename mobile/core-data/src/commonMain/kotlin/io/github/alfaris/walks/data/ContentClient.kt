package io.github.alfaris.walks.data

import io.github.alfaris.walks.model.ContentJson
import io.github.alfaris.walks.model.ContentV1
import io.github.alfaris.walks.model.decodeContent
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** What a content check found. */
sealed interface ContentResult {
    /** New content, with the ETag to send next time. */
    data class Fresh(val content: ContentV1, val etag: String?) : ContentResult
    /** The app already has this version (304). */
    data object NotModified : ContentResult
    /** The app is too old for this content: it should ask the visitor to update (contracts/README.md). */
    data class UpdateRequired(val minAppVersion: Int) : ContentResult
}

/**
 * Reads GET /api/v1/content. Sends the last ETag, so an unchanged version costs a
 * 304 and no body. A stub for M0: storing the content (SQLDelight) comes with M1.
 */
class ContentClient(
    private val http: HttpClient,
    private val url: String,
    /** This build's version code (Android) or build number (iOS). */
    private val appVersion: Int,
) {
    suspend fun fetch(lastEtag: String? = null): ContentResult {
        val response = http.get(url) {
            if (lastEtag != null) header(HttpHeaders.IfNoneMatch, lastEtag)
        }
        if (response.status == HttpStatusCode.NotModified) return ContentResult.NotModified
        check(response.status == HttpStatusCode.OK) { "Content request failed: ${response.status}" }
        val text = response.bodyAsText()
        // The version check comes before decoding the content: content an old app can't
        // read is exactly why minAppVersion was raised, so decoding it first could fail.
        val minAppVersion = ContentJson.parseToJsonElement(text).jsonObject["minAppVersion"]?.jsonPrimitive?.intOrNull ?: 0
        if (minAppVersion > appVersion) return ContentResult.UpdateRequired(minAppVersion)
        return ContentResult.Fresh(decodeContent(text), response.headers[HttpHeaders.ETag])
    }
}

/** An HTTP client with the platform's engine (OkHttp on Android and the JVM, Darwin on iOS). */
expect fun platformHttpClient(): HttpClient
