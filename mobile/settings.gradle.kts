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
// local.properties). Without one, the shared modules still build and test on the JVM.
val hasAndroidSdk = System.getenv("ANDROID_HOME") != null || System.getenv("ANDROID_SDK_ROOT") != null ||
    file("local.properties").takeIf { it.exists() }?.readText()?.contains("sdk.dir") == true
if (hasAndroidSdk) include(":androidApp")
