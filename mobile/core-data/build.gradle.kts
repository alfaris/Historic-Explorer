import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    // Bytecode for Java 17 (what Android dexes), built with whichever JDK runs Gradle.
    jvm { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }
    iosArm64()
    iosSimulatorArm64()
    iosX64()

    sourceSets {
        commonMain.dependencies {
            api(project(":core-model"))
            api(libs.ktor.client.core)
            api(libs.coroutines.core)
        }
        jvmMain.dependencies {
            implementation(libs.ktor.client.okhttp)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.ktor.client.mock)
            implementation(libs.coroutines.test)
        }
    }
}

tasks.withType<JavaCompile>().configureEach { options.release.set(17) }

tasks.withType<Test>().configureEach {
    val contracts = rootDir.resolve("../contracts")
    inputs.dir(contracts)
    systemProperty("contracts", contracts.absolutePath)
}
