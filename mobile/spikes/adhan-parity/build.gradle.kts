// Spike for #254: does the Kotlin Multiplatform port of adhan give the web's
// prayer times to the minute? Checked on the JVM against contracts/vectors.
plugins { kotlin("jvm") version "2.0.21" }

repositories { mavenCentral() }

dependencies {
    testImplementation("com.batoulapps.adhan:adhan2:0.0.5")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation(kotlin("test"))
}

kotlin { jvmToolchain(21) }

tasks.test {
    useJUnitPlatform()
    val vectors = rootDir.resolve("../../../contracts/vectors/prayer-times-cairo.json")
    // An input, so the test runs again whenever the vectors change.
    inputs.file(vectors)
    systemProperty("vectors", vectors.absolutePath)
    testLogging { events("passed", "failed"); showStandardStreams = true }
}
