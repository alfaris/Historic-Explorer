import { describe, expect, it } from 'vitest';
import { QUIZ_ROUNDS, datedPlaces, fairPairs, hasQuiz, quizRounds, yearsApart } from './quiz';
import { quizShareText } from './quiz-share';

const place = (id: number, builtFrom?: number, builtTo?: number, routeId = 'r') => ({ id, routeId, ...(builtFrom ? { builtFrom } : {}), ...(builtTo ? { builtTo } : {}) });
// A fixed sequence for "random", so the tests are repeatable.
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// A small seeded random generator (mulberry32), like Math.random but repeatable.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('yearsApart', () => {
  it('measures from the end of one building to the start of the other', () => {
    expect(yearsApart(place(1, 879), place(2, 1356, 1363))).toBe(477);
    expect(yearsApart(place(2, 1356, 1363), place(1, 879))).toBe(477);
    expect(yearsApart(place(1, 1356, 1363), place(2, 1360))).toBeLessThan(0);
  });
});

describe('fairPairs', () => {
  it('leaves out pairs that overlap or are under 20 years apart', () => {
    const pairs = fairPairs([place(1, 879), place(2, 890), place(3, 1356, 1363), place(4, 1370)]);
    const ids = pairs.map(([a, b]) => `${a.id}-${b.id}`);
    expect(ids).toEqual(['1-3', '1-4', '2-3', '2-4']);
  });
});

describe('hasQuiz', () => {
  it('needs 3 dated places on the route and one fair pair', () => {
    const places = [place(1, 879), place(2, 1356), place(3), place(4, 1500, undefined, 'other')];
    expect(datedPlaces(places, 'r').map(p => p.id)).toEqual([1, 2]);
    expect(hasQuiz(places, 'r')).toBe(false);
    expect(hasQuiz([...places, place(5, 1900)], 'r')).toBe(true);
    expect(hasQuiz([place(1, 1000), place(2, 1005), place(3, 1010)], 'r')).toBe(false);
  });
});

describe('quizRounds', () => {
  const route = [place(1, 641), place(2, 879), place(3, 1085), place(4, 1356, 1363), place(5, 1517), place(6, 1830), place(7)];

  it('makes up to 5 rounds, with the older place as the answer', () => {
    const rounds = quizRounds(route, 'r', seq(0.1, 0.7, 0.3, 0.9, 0.5));
    expect(rounds).toHaveLength(QUIZ_ROUNDS);
    for (const r of rounds) {
      expect(r.older.builtFrom).toBe(Math.min(r.a.builtFrom!, r.b.builtFrom!));
      expect(yearsApart(r.a, r.b)).toBeGreaterThanOrEqual(20);
      expect(r.a.id).not.toBe(r.b.id);
    }
  });

  it('asks about each place at most twice, and never repeats a pair', () => {
    const rounds = quizRounds(route, 'r', seq(0.42, 0.13, 0.77));
    const uses = new Map<number, number>();
    for (const r of rounds) for (const p of [r.a, r.b]) uses.set(p.id, (uses.get(p.id) ?? 0) + 1);
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(2);
    const keys = rounds.map(r => [r.a.id, r.b.id].sort().join('-'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has fewer rounds on a small route', () => {
    expect(quizRounds([place(1, 641), place(2, 1356), place(3, 1830)], 'r', seq(0.5))).toHaveLength(3);
  });

  it('makes the longest game the places allow, whatever the shuffle', () => {
    // 4 fair pairs here, but each place may be asked about only twice: at most 4 rounds.
    const small = [place(1, 690), place(2, 882), place(3, 1908, 1910), place(4, 1909)];
    for (let seed = 1; seed <= 50; seed++) expect(quizRounds(small, 'r', seeded(seed))).toHaveLength(4);
  });

  it('shows the older place on either side', () => {
    const sides = new Set(quizRounds(route, 'r', seq(0.1, 0.9)).map(r => r.older === r.a));
    expect(sides.size).toBe(2);
  });
});

describe('quizShareText', () => {
  it('says the score and the walk in each language', () => {
    expect(quizShareText(4, 5, 'Coptic Cairo', 'en')).toBe('I got 4 of 5 on "Which came first?" on the Coptic Cairo walk with Cairo Walks');
    expect(quizShareText(4, 5, 'القاهرة القبطية', 'ar')).toBe('أجبت 4 من 5 في مسابقة «أيهما بُني أولاً؟» في جولة القاهرة القبطية مع Cairo Walks');
    expect(quizShareText(2, 3, 'Le Caire copte', 'fr')).toBe('J’ai trouvé 2 sur 3 à « Lequel est le plus ancien ? » sur la visite Le Caire copte avec Cairo Walks');
    expect(quizShareText(0, 4, 'El Cairo copto', 'es')).toBe('He acertado 0 de 4 en «¿Cuál es más antiguo?» en el paseo El Cairo copto con Cairo Walks');
  });
});

describe('across Cairo', () => {
  const all = [place(1, 641, undefined, 'a'), place(2, 1356, undefined, 'b'), place(3, 1830, undefined, 'c'), place(4, undefined, undefined, 'a')];

  it('takes dated places from every route', () => {
    expect(datedPlaces(all, null).map(p => p.id)).toEqual([1, 2, 3]);
    expect(hasQuiz(all, null)).toBe(true);
    // No route on its own has enough.
    expect(['a', 'b', 'c'].some(r => hasQuiz(all, r))).toBe(false);
  });

  it('pairs places from different routes', () => {
    const rounds = quizRounds(all, null, seq(0.3, 0.8));
    expect(rounds).toHaveLength(3);
    expect(rounds.every(r => r.a.routeId !== r.b.routeId)).toBe(true);
  });

  it('shares a score across Cairo', () => {
    expect(quizShareText(4, 5, null, 'en')).toBe('I got 4 of 5 on "Which came first?" across Cairo with Cairo Walks');
    expect(quizShareText(4, 5, null, 'ar')).toContain('عن آثار القاهرة');
  });
});
