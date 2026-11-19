package io.github.alfaris.walks.rules

import io.github.alfaris.walks.model.OpeningHours
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.toLocalDateTime

// A port of src/lib/opening-hours.ts (openStatus), checked against
// contracts/vectors/opening-hours.json. Keep the two in step.

private const val DAY = 24 * 60
private const val WEEK = 7 * DAY

/** Day of week (0 = Sunday, as the web's Date.getDay()) and minutes since midnight, in the city's time zone. */
data class CityTime(val day: Int, val minutes: Int)

fun cityTime(at: Instant, timeZone: TimeZone): CityTime {
    val local = at.toLocalDateTime(timeZone)
    return CityTime(local.dayOfWeek.isoDayNumber % 7, local.hour * 60 + local.minute)
}

/** A moment in the coming week: how many days from today, and the time that day. */
data class When(val inDays: Int, val minutes: Int)

sealed interface OpenStatus {
    /** Open; [closes] is null when open round the clock. */
    data class Open(val closes: When?) : OpenStatus
    /** Closed; [opens] is null when it has no opening hours at all. */
    data class Closed(val opens: When?) : OpenStatus
}

private val TIME = Regex("^([01]\\d|2[0-3]):([0-5]\\d)$")

/** Minutes since midnight of an HH:MM time; null for anything else (the server sends only HH:MM, but never crash on one). */
private fun toMinutes(time: String): Int? = TIME.find(time)?.destructured?.let { (h, m) -> h.toInt() * 60 + m.toInt() }

// Every opening as [start, end) in minutes from Sunday 00:00, merged where ranges touch.
private fun intervals(hours: OpeningHours): List<LongArray> {
    val list = mutableListOf<LongArray>()
    hours.days.forEachIndexed { day, ranges ->
        for (r in ranges) {
            val open = toMinutes(r.open) ?: continue
            val close = toMinutes(r.close) ?: continue
            val start = (day * DAY + open).toLong()
            var end = (day * DAY + close).toLong()
            if (end <= start) end += DAY
            list += longArrayOf(start, end)
        }
    }
    list.sortBy { it[0] }
    val merged = mutableListOf<LongArray>()
    for (span in list) {
        val last = merged.lastOrNull()
        if (last != null && span[0] <= last[1]) last[1] = maxOf(last[1], span[1]) else merged += span.copyOf()
    }
    // Open round the clock all week: one unbroken range at least a week long.
    if (merged.size == 1 && merged[0][1] - merged[0][0] >= WEEK) return listOf(longArrayOf(0, Long.MAX_VALUE))
    return merged
}

/** Whether the place is open at [at], and when that changes. Null when it has no hours. */
fun openStatus(hours: OpeningHours?, at: Instant, timeZone: TimeZone): OpenStatus? {
    if (hours == null) return null
    val list = intervals(hours)
    if (list.isEmpty()) return OpenStatus.Closed(null)
    if (list[0][1] == Long.MAX_VALUE) return OpenStatus.Open(null)
    val (day, minutes) = cityTime(at, timeZone)
    val now = (day * DAY + minutes).toLong()
    fun whenAt(t: Long): When {
        val total = minutes + (t - now)
        return When(total.floorDiv(DAY.toLong()).toInt(), total.mod(DAY.toLong()).toInt())
    }
    // This week's ranges and, for ranges past Saturday midnight, last week's.
    for ((s, e) in list.map { it[0] to it[1] }) {
        for (shift in longArrayOf(-WEEK.toLong(), 0)) {
            if (now >= s + shift && now < e + shift) return OpenStatus.Open(whenAt(e + shift))
        }
    }
    val next = list.minOf { if (it[0] > now) it[0] else it[0] + WEEK }
    return OpenStatus.Closed(whenAt(next))
}
