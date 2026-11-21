import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "io.github.alfaris.walks"
    compileSdk = 35

    defaultConfig {
        minSdk = 26 // Android 8
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    // One flavor per city, each its own app on the Play Store (see CityConfig).
    flavorDimensions += "city"
    productFlavors {
        create("cairo") {
            dimension = "city"
            // Both must equal Cities.CAIRO's (FlavorTest checks them).
            applicationId = "io.github.alfaris.walks.cairo"
            val appName = "Cairo Walks"
            resValue("string", "app_name", appName)
            buildConfigField("String", "APP_NAME", "\"$appName\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(project(":core-data"))
    implementation(project(":core-rules"))
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.material3)
    implementation(libs.compose.ui)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime)
    testImplementation(kotlin("test"))
}
