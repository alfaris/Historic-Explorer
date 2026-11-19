// Pure visitor logic, beyond hours: walking times and pace, distances and
// arrival, nearby places, notices, the quiz and passport stamps.

import { distanceMeters, nearest, updateArrival, type ArrivalState } from '../../src/lib/geo.js';
import { nearbyOnOtherRoutes } from '../../src/lib/nearby.js';
import { noticesFor, type Notice } from '../../src/lib/notices.js';
import { PACE_FACTOR, PACES, readPace } from '../../src/lib/pace.js';
import { mergeStamps, parseStamps, stampCount, withStamp, type Stamps } from '../../src/lib/passport.js';
import { datedPlaces, fairPairs, hasQuiz, quizRounds, yearsApart } from '../../src/lib/quiz.js';
import { beats, mergeBests, parseBests } from '../../src/lib/quiz-best.js';
import { atPace, walkMinutes } from '../../src/lib/walk.js';
import { seeded, type VectorSet } from './common.js';

/** Places for nearby: a cluster on three routes around Bab Zuweila, metres apart (north = +lat), plus one far away. */
const north = (m: number) => m / 111_320;
const east = (m: number) => m / (111_320 * Math.cos((30.043 * Math.PI) / 180));
const NEARBY_PLACES = [
  { id: 1, routeId: 'a', lat: 30.043, lng: 31.257 },
  { id: 2, routeId: 'a', lat: 30.043 + north(150), lng: 31.257 },
  { id: 3, routeId: 'b', lat: 30.043 + north(100), lng: 31.257 + east(50) },
  { id: 4, routeId: 'b', lat: 30.043 - north(300), lng: 31.257 },
  { id: 5, routeId: 'c', lat: 30.043, lng: 31.257 + east(200) },
  { id: 6, routeId: 'c', lat: 30.043, lng: 31.257 - east(200) }, // the same distance from 1 as 5: lower ID first
  { id: 7, routeId: 'c', lat: 30.043 + north(420), lng: 31.257 }, // 420 m: just within 7 minutes? (straight line × 1.3 at 75 m/min)
  { id: 8, routeId: 'c', lat: 30.043 + north(410), lng: 31.257 + east(20) },
  { id: 9, routeId: 'd', lat: 30.06, lng: 31.26 }, // far away
];


export const walkVectors: VectorSet = {
  name: 'walk-pace',
  build: () => {
    const meters = [0, 1, 37, 38, 100, 250, 400, 1000, 2500];
    return {
      about:
        'Walking times (walkMinutes and atPace in src/lib/walk.ts, PACE_FACTOR and readPace in src/lib/pace.ts). walkMinutes takes straight-line metres and a pace factor; ' +
        'atPace scales a time in minutes. Both round to whole minutes, at least 1. `readPace` maps a stored value to a pace (anything unknown is usual).',
      paceFactor: PACE_FACTOR,
      cases: [
        ...meters.flatMap(m => PACES.map(pace => ({ walkMinutes: { meters: m, factor: PACE_FACTOR[pace] }, out: walkMinutes(m, PACE_FACTOR[pace]) }))),
        ...[1, 2, 5, 12, 45].flatMap(min => PACES.map(pace => ({ atPace: { minutes: min, factor: PACE_FACTOR[pace] }, out: atPace(min, PACE_FACTOR[pace]) }))),
        ...[null, '', 'usual', 'relaxed', 'brisk', 'Brisk', 'fast'].map(stored => ({ readPace: stored, out: readPace(stored) })),
      ],
    };
  },
};

export const geoVectors: VectorSet = {
  name: 'geo',
  build: () => {
    const sample = NEARBY_PLACES.map(({ id, lat, lng }) => ({ id, lat, lng }));
    // A walk past the first place: far, approaching, at it, jittering at the edge, leaving, and an imprecise fix.
    const p0 = sample[0];
    const offset = (m: number) => ({ lat: p0.lat + m / 111_320, lng: p0.lng }); // m metres north
    const fixes = [
      { ...offset(200), accuracy: 10 }, { ...offset(31), accuracy: 10 }, { ...offset(29), accuracy: 10 }, { ...offset(10), accuracy: 10 },
      { ...offset(45), accuracy: 10 }, { ...offset(25), accuracy: 10 }, { ...offset(61), accuracy: 10 }, { ...offset(20), accuracy: 10 },
      { ...offset(5), accuracy: 51 }, { ...offset(500), accuracy: 10 },
    ];
    let state: ArrivalState = { atId: null };
    const arrival = fixes.map(fix => {
      const r = updateArrival(state, fix, sample);
      state = r.state;
      return { fix, state: r.state, arrivedId: r.arrivedId };
    });
    return {
      about:
        'Distances and arrival (src/lib/geo.ts). distanceMeters is the haversine distance with Earth radius 6,371,000 m. Distances are stored rounded to 2 decimals: a port\'s unrounded value must be within 0.005 m. ' +
        '`nearest` picks the closest place (lowest distance, first on a tie). `arrival` is one walk of GPS fixes fed in order to updateArrival, starting from {atId: null}: ' +
        'arriving needs ≤ 30 m, leaving needs > 60 m from the place arrived at, and fixes less precise than 50 m are ignored.',
      places: sample,
      cases: [
        ...sample.slice(1).map(p => ({ distance: [p0.id, p.id], meters: Number(distanceMeters(p0, p).toFixed(2)) })),
        ...fixes.map(fix => {
          const n = nearest(fix, sample);
          return { nearest: { lat: fix.lat, lng: fix.lng }, id: n?.place.id ?? null, meters: n ? Number(n.meters.toFixed(2)) : null };
        }),
        { arrival },
      ],
    };
  },
};

export const nearbyVectors: VectorSet = {
  name: 'nearby',
  build: () => ({
    about:
      'Places on other routes a short walk away (nearbyOnOtherRoutes in src/lib/nearby.ts): at most 3, within 7 minutes at the usual pace (straight-line metres × 1.3, ' +
      'at 75 m a minute, rounded up), nearest first, then lowest ID. `minutes` is at the usual pace (factor 1).',
    places: NEARBY_PLACES,
    cases: NEARBY_PLACES.map(p => ({
      place: p.id,
      nearby: nearbyOnOtherRoutes(p, NEARBY_PLACES).map(n => ({ id: n.place.id, minutes: n.minutes })),
    })),
  }),
};

const NOTICES: Notice[] = [
  { textEn: 'Everywhere, no dates', textAr: 'في كل مكان' },
  { textEn: 'Everywhere, important, December', textAr: 'مهم', from: '2026-12-01', until: '2026-12-31', important: true },
  { textEn: 'Route only, from the 10th', textAr: 'المسار', routeId: 'al-muizz', from: '2026-12-10' },
  { textEn: 'Place only, until the 5th', textAr: 'المكان', placeId: 1, until: '2026-12-05' },
  { textEn: 'Place, important, one day', textAr: 'يوم واحد', placeId: 1, from: '2026-12-05', until: '2026-12-05', important: true },
];

export const noticeVectors: VectorSet = {
  name: 'notices',
  build: () => {
    const dates = ['2026-11-30', '2026-12-01', '2026-12-05', '2026-12-06', '2026-12-10', '2026-12-31', '2027-01-01'];
    const scopes = [{ app: true as const }, { routeId: 'al-muizz' }, { routeId: 'coptic-cairo' }, { placeId: 1 }, { placeId: 2 }];
    return {
      about:
        'Which notices show on a Cairo date in one place on screen (noticesFor in src/lib/notices.ts): the app-wide ones (no route or place), a route\'s, or a place\'s, ' +
        'active from `from` to `until` inclusive, important ones first, otherwise in the listed order. `shown` lists indexes into `notices`.',
      notices: NOTICES,
      cases: dates.flatMap(date => scopes.map(scope => ({ date, scope, shown: noticesFor(NOTICES, date, scope).map(n => NOTICES.indexOf(n)) }))),
    };
  },
};

/** Places with build years: equal years, overlapping ranges, a pair exactly 20 years apart, and a route with too few dated places. */
export const QUIZ_PLACES = [
  { id: 1, routeId: 'old', builtFrom: 642 },
  { id: 2, routeId: 'old', builtFrom: 876, builtTo: 879 },
  { id: 3, routeId: 'old', builtFrom: 970, builtTo: 972 },
  { id: 4, routeId: 'old', builtFrom: 992 }, // exactly 20 years after 3 ends: fair
  { id: 5, routeId: 'old', builtFrom: 1085, builtTo: 1092 },
  { id: 6, routeId: 'old', builtFrom: 1085 }, // the same year as 5: never paired with it
  { id: 7, routeId: 'old', builtFrom: 1356, builtTo: 1363 },
  { id: 8, routeId: 'old', builtFrom: 1360 }, // inside 7's range: overlap
  { id: 9, routeId: 'old', builtFrom: 1504, builtTo: 1505 },
  { id: 10, routeId: 'old' }, // no year: not in the quiz
  { id: 11, routeId: 'new', builtFrom: 1869 },
  { id: 12, routeId: 'new', builtFrom: 1880 }, // 11 years from 11: not fair
  { id: 13, routeId: 'new' },
  { id: 14, routeId: 'few', builtFrom: 1200 },
  { id: 15, routeId: 'few', builtFrom: 1500 }, // only two dated places: no quiz
];

export const quizVectors: VectorSet = {
  name: 'quiz',
  build: () => {
    const places = QUIZ_PLACES;
    const scopes = [null, 'old', 'new', 'few', 'none'];
    const games = [null, 'old', null, 'old'].map((scope, i) => {
      const random = seeded(1000 + i);
      const rounds = quizRounds(places, scope, random.next);
      return { scope, random: random.drawn, rounds: rounds.map(r => ({ a: r.a.id, b: r.b.id, older: r.older.id })) };
    });
    const dated = datedPlaces(places, null);
    return {
      about:
        'The "Which came first?" quiz (src/lib/quiz.ts) and best scores (src/lib/quiz-best.ts) over `places`. A scope is a route ID, or null for all of Cairo. ' +
        '`dated` lists the IDs with a build year; `pairs` the fair pairs in order (≥ 20 years apart, no overlap). Each game lists the random numbers quizRounds drew, ' +
        'in order, and the rounds it made from them: feed the same numbers to get the same rounds. `beats` compares best scores by share, then by rounds.',
      places,
      cases: [
        ...scopes.map(scope => ({
          scope,
          dated: datedPlaces(places, scope).map(p => p.id),
          pairs: fairPairs(datedPlaces(places, scope)).map(([a, b]) => [a.id, b.id]),
          hasQuiz: hasQuiz(places, scope),
        })),
        ...dated.flatMap((a, i) => dated.slice(i + 1).map(b => ({ yearsApart: [a.id, b.id], out: yearsApart(a, b) }))),
        ...games.map(game => ({ game })),
        ...[
          [{ score: 3, of: 5 }, undefined], [{ score: 3, of: 5 }, { score: 3, of: 5 }], [{ score: 4, of: 4 }, { score: 3, of: 3 }],
          [{ score: 2, of: 4 }, { score: 3, of: 5 }], [{ score: 3, of: 5 }, { score: 2, of: 4 }], [{ score: 0, of: 5 }, { score: 0, of: 3 }],
        ].map(([next, old]) => ({ beats: { next, old: old ?? null }, out: beats(next!, old) })),
        ...['', 'null', '[]', '{"a":{"score":3,"of":5}}', '{"a":{"score":6,"of":5},"b":{"score":2,"of":21},"c":{"score":1.5,"of":3},"d":{"score":0,"of":1}}'].map(raw => ({
          parseBests: raw,
          out: parseBests(raw || null),
        })),
        { mergeBests: [{ a: { score: 3, of: 5 }, b: { score: 1, of: 2 } }, { a: { score: 4, of: 5 }, b: { score: 1, of: 3 }, c: { score: 2, of: 2 } }], out: mergeBests({ a: { score: 3, of: 5 }, b: { score: 1, of: 2 } }, { a: { score: 4, of: 5 }, b: { score: 1, of: 3 }, c: { score: 2, of: 2 } }) },
      ],
    };
  },
};

export const passportVectors: VectorSet = {
  name: 'passport',
  build: () => {
    const s0: Stamps = {};
    const steps: { routeId: string; date: string; spot: { found: number; total: number }; at?: number }[] = [
      { routeId: 'al-muizz', date: '2026-12-01', spot: { found: 2, total: 5 }, at: 1796112000000 },
      { routeId: 'al-muizz', date: '2026-12-03', spot: { found: 1, total: 5 } }, // walked again, fewer found: the stamp keeps 2 and its date
      { routeId: 'al-muizz', date: '2026-12-04', spot: { found: 4, total: 6 } }, // more found, and a new challenge since
      { routeId: 'coptic-cairo', date: '2026-12-04', spot: { found: 9, total: 3 } }, // found is capped at total
      { routeId: 'coptic-cairo', date: '2026-12-06', spot: { found: 7, total: 5 } }, // walked again with more found than challenges: capped at the new total
    ];
    let stamps = s0;
    const sequence = steps.map(step => (stamps = withStamp(stamps, step.routeId, step.date, step.spot, step.at)));
    const a: Stamps = { x: { date: '2026-12-02', found: 1, spots: 3 }, y: { date: '2026-12-01', found: 2, spots: 2, at: 200 } };
    const b: Stamps = { x: { date: '2026-12-01', found: 0, spots: 4, at: 100 }, y: { date: '2026-12-01', found: 1, spots: 3, at: 100 }, z: { date: '2026-12-05', found: 0, spots: 0 } };
    return {
      about:
        'Passport stamps (src/lib/passport.ts). `withStamp` is applied in order from no stamps; each step lists the stamps after it. A route\'s first finish keeps its date ' +
        '(and time, `at`, in ms since the epoch); walking it again only raises `found` (capped at `spots`) and `spots`. `mergeStamps` joins two sets: the earlier finish, ' +
        'the most found and spots. `parseStamps` reads a stored value, keeping only well-formed stamps.',
      cases: [
        { withStamp: steps, after: sequence },
        { mergeStamps: [a, b], out: mergeStamps(a, b) },
        { mergeStamps: [b, a], out: mergeStamps(b, a) },
        ...['', 'nope', '[]', '{"a":{"date":"2026-12-01","found":2,"spots":3}}', '{"a":{"date":"12/01/2026","found":1,"spots":1},"b":{"date":"2026-12-01","found":5,"spots":2,"at":-1},"c":{"date":"2026-12-01","found":-1,"spots":1.5,"at":7}}'].map(raw => ({
          parseStamps: raw,
          out: parseStamps(raw || null),
        })),
        { stampCount: { stamps: sequence.at(-1), routes: ['al-muizz', 'coptic-cairo', 'darb-al-ahmar'] }, out: stampCount(sequence.at(-1)!, [{ id: 'al-muizz' }, { id: 'coptic-cairo' }, { id: 'darb-al-ahmar' }]) },
      ],
    };
  },
};
