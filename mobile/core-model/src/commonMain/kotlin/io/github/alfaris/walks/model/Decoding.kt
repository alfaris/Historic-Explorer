package io.github.alfaris.walks.model

import kotlinx.serialization.json.Json

/** How the apps read /api/v1/content (contracts/README.md): unknown fields are ignored, as later content only adds. */
val ContentJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}

fun decodeContent(text: String): ContentV1 = ContentJson.decodeFromString(ContentV1.serializer(), text)
