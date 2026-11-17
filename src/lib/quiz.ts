// "Which came first?": a short quiz on the finish screen, built from the build
// years the route's places already have. Each round shows two places from the
// route; the visitor taps the older one. Pure, so it works offline and is tested.

import type { BuiltFields } from './eras';

/** Fewer dated places than this, and the route has no quiz. */
export const QUIZ_MIN_PLACES = 3;
/** At most this many rounds. */
export const QUIZ_ROUNDS = 5;
/** Two places closer together than this (in years) aren't asked about. */
export const MIN_GAP_YEARS = 20;
/** A place is asked about in at most this many rounds of one game. */
const MAX_USES = 2;

type Dated = BuiltFields & { id: number; routeId: string };
export type Round<T> = { a: T; b: T; older: T };

/** A route's ID, or null for every route at once (the quiz "across Cairo", from Through the ages). */
export type QuizScope = string | null;
/** Where the best score of the all-of-Cairo quiz is kept, beside the routes' own (see quiz-best). */
export const ALL_CAIRO_KEY = 'all-of-cairo';

/** The places with a build year on a route, or on every route. */
export const datedPlaces = <T extends Dated>(places: T[], scope: QuizScope): T[] =>
  places.filter(p => (scope === null || p.routeId === scope) && Number.isInteger(p.builtFrom));

/** The years between two places' building, or a negative number when their building overlapped. */
export function yearsApart(a: BuiltFields, b: BuiltFields): number {
  const aEnd = a.builtTo ?? a.builtFrom!;
  const bEnd = b.builtTo ?? b.builtFrom!;
  return Math.max(b.builtFrom! - aEnd, a.builtFrom! - bEnd);
}

/** Every pair that makes a fair question: far enough apart, with no overlap. */
export function fairPairs<T extends Dated>(dated: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (yearsApart(dated[i], dated[j]) >= MIN_GAP_YEARS) pairs.push([dated[i], dated[j]]);
    }
  }
  return pairs;
}

/** Whether the route has a quiz: enough dated places, and at least one fair pair. */
export const hasQuiz = (places: Dated[], scope: QuizScope) => {
  const dated = datedPlaces(places, scope);
  return dated.length >= QUIZ_MIN_PLACES && fairPairs(dated).length > 0;
};

/**
 * A game: up to QUIZ_ROUNDS fair pairs in random order, each place in at most
 * MAX_USES rounds, each pair shown in a random order. `random` returns [0, 1),
 * like Math.random, so tests can fix it.
 */
export function quizRounds<T extends Dated>(places: T[], scope: QuizScope, random: () => number = Math.random): Round<T>[] {
  const pairs = fairPairs(datedPlaces(places, scope));
  // A shuffle can use up a place early and leave a short game; keep the longest of a few.
  let best: Round<T>[] = [];
  for (let attempt = 0; attempt < 20 && best.length < Math.min(QUIZ_ROUNDS, pairs.length); attempt++) {
    const rounds = oneGame([...pairs], random);
    if (rounds.length > best.length) best = rounds;
  }
  return best;
}

function oneGame<T extends Dated>(pairs: [T, T][], random: () => number): Round<T>[] {
  // Fisher–Yates shuffle.
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const uses = new Map<number, number>();
  const rounds: Round<T>[] = [];
  for (const [x, y] of pairs) {
    if (rounds.length >= QUIZ_ROUNDS) break;
    if ((uses.get(x.id) ?? 0) >= MAX_USES || (uses.get(y.id) ?? 0) >= MAX_USES) continue;
    uses.set(x.id, (uses.get(x.id) ?? 0) + 1);
    uses.set(y.id, (uses.get(y.id) ?? 0) + 1);
    const [a, b] = random() < 0.5 ? [x, y] : [y, x];
    rounds.push({ a, b, older: x.builtFrom! < y.builtFrom! ? x : y });
  }
  return rounds;
}
