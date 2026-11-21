package io.github.alfaris.walks.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.github.alfaris.walks.BuildConfig
import io.github.alfaris.walks.data.ContentClient
import io.github.alfaris.walks.data.ContentResult
import io.github.alfaris.walks.data.platformHttpClient

/** M0's "hello content" screen: the app reads the live content and says how much there is. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val client = ContentClient(platformHttpClient(), flavorCity.contentUrl, BuildConfig.VERSION_CODE)
        setContent {
            val colors = lightColorScheme(
                primary = Color(flavorCity.colors.primary),
                secondary = Color(flavorCity.colors.accent),
                background = Color(flavorCity.colors.background),
            )
            MaterialTheme(colorScheme = colors) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ContentCount(client)
                }
            }
        }
    }
}

@Composable
private fun ContentCount(client: ContentClient) {
    var text by remember { mutableStateOf("Loading…") }
    LaunchedEffect(Unit) {
        text = runCatching { client.fetch() }.fold(
            onSuccess = {
                when (it) {
                    is ContentResult.Fresh -> "${it.content.content.places.size} places on ${it.content.content.routes.size} routes"
                    ContentResult.NotModified -> "Up to date"
                    is ContentResult.UpdateRequired -> "Please update the app"
                }
            },
            onFailure = { "Couldn't load the content: ${it.message}" },
        )
    }
    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(flavorCity.appName, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        Text(text, style = MaterialTheme.typography.bodyLarge)
    }
}
