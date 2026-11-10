// "Suggest from stats" in the route editor: the route's stops that visitors
// play the audio for and arrive at most, as must-see candidates. The top
// third of the stops (at least 2, at most 6), leaving out stops no one played
// or arrived at; ties go to the earlier stop in walking order. With too
// little data it says so rather than guess. Pure.

import type { DayStats } from '../lib/stats';

/** Fewer audio plays than this on the route, and there's too little to go on. */
export const MIN_PLAYS = 20;

export type Candidate = { id: number; plays: number; arrivals: number; score: number };
export type Suggestion = { kind: 'tooLittle'; plays: number } | { kind: 'ok'; picks: Candidate[] };

/** How many to suggest for a route with this many stops: a third, at least 2, at most 6 (never more than there are). */
export const suggestCount = (stops: number) => Math.min(stops, Math.max(2, Math.min(6, Math.round(stops / 3))));

/** The suggested must-see stops, best first, from the stats of the stops in `stopIds` (walking order). */
export function suggestMustSee(stopIds: number[], total: DayStats): Suggestion {
  const rows = stopIds.map((id, order) => {
    const plays = total.plays[String(id)] ?? 0;
    const arrivals = total.arrivals[String(id)] ?? 0;
    return { id, plays, arrivals, score: plays + arrivals, order };
  });
  const plays = rows.reduce((n, r) => n + r.plays, 0);
  if (plays < MIN_PLAYS) return { kind: 'tooLittle', plays };
  // A stop no one played or arrived at isn't suggested, even to fill the count.
  const picks = rows
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, suggestCount(rows.length))
    .map(({ order: _order, ...c }) => c);
  return { kind: 'ok', picks };
}
