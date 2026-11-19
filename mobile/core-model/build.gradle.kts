import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    // Bytecode for Java 17 (what Android dexes), built with whichever JDK runs Gradle.
    jvm { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }
    // Compiled on macOS only (CI's ios job); the Android app uses the JVM target.
    iosArm64()
    iosSimulatorArm64()
    iosX64()

    sourceSets {
        commonMain.dependencies {
            api(libs.serialization.json)
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

tasks.withType<Test>().configureEach {
    val contracts = rootDir.resolve("../contracts")
    inputs.dir(contracts)
    systemProperty("contracts", contracts.absolutePath)
}

tasks.withType<JavaCompile>().configureEach { options.release.set(17) }
