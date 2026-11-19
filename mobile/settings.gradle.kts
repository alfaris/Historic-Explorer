// The Cairo Walks apps (and later cities, as separate apps on the same code):
// shared Kotlin Multiplatform modules, and the Android app. See mobile/README.md.
rootProject.name = "walks"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":core-model", ":core-rules", ":core-data")

// The Android app needs the Android SDK (CI has it; set ANDROID_HOME or sdk.dir in
// local.properties). Without one, the shared modules still build and test on the JVM,
// and a warning says the app was left out.
val sdkDir: String? = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
    ?: file("local.properties").takeIf { it.exists() }?.readLines()
        ?.firstNotNullOfOrNull { Regex("^sdk\\.dir=(.+)$").find(it.trim())?.groupValues?.get(1)?.trim() }
if (sdkDir != null && file(sdkDir).isDirectory) {
    include(":androidApp")
} else {
    logger.warn("No Android SDK found (ANDROID_HOME, or sdk.dir in local.properties): :androidApp is left out of this build.")
}
