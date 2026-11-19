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
            api(libs.datetime)
            implementation(libs.adhan2)
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

tasks.withType<JavaCompile>().configureEach { options.release.set(17) }

tasks.withType<Test>().configureEach {
    // The web's golden vectors: an input, so the tests run again whenever they change.
    val contracts = rootDir.resolve("../contracts")
    inputs.dir(contracts)
    systemProperty("contracts", contracts.absolutePath)
}
