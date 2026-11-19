package io.github.alfaris.walks.app

import io.github.alfaris.walks.BuildConfig
import kotlin.test.Test
import kotlin.test.assertEquals

class FlavorTest {
    @Test
    fun theFlavorsApplicationIdIsItsCitys() {
        assertEquals(flavorCity.applicationId, BuildConfig.APPLICATION_ID)
    }
}
