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
// local.properties is a properties file (Windows paths are escaped there), so it's read as one;
// the first candidate that is an existing directory wins.
val localSdkDir: String? = file("local.properties").takeIf { it.exists() }
    ?.reader()?.use { java.util.Properties().apply { load(it) } }?.getProperty("sdk.dir")
val sdkDir: String? = listOfNotNull(System.getenv("ANDROID_HOME"), System.getenv("ANDROID_SDK_ROOT"), localSdkDir)
    .firstOrNull { file(it).isDirectory }
if (sdkDir != null) {
    include(":androidApp")
} else {
    logger.warn("No Android SDK found (ANDROID_HOME, or sdk.dir in local.properties): :androidApp is left out of this build.")
}
