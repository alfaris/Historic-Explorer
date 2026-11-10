// The kind of each place for its audio guide (mosque, mausoleum, café, ...)
// and its opening move, from its category, name and ID. Small, so the app can
// version audio URLs by it (narrationSource); how each kind is told is in
// guide-style.ts, used by the server only. Pure.

import type { Location } from '../data/locations';
import { isActiveMosque } from './prayer-times.js';
import { nameOf, type Lang } from '../i18n/lang.js';

export type GuidePlace = Pick<Location, 'id' | 'nameEn' | 'nameAr' | 'nameFr' | 'nameEs' | 'category' | 'mosque'>;

export type GuideKind =
  | 'mosque'
  | 'mausoleum'
  | 'charity'
  | 'church'
  | 'synagogue'
  | 'house'
  | 'museum'
  | 'gate'
  | 'water'
  | 'monument'
  | 'coffee'
  | 'restaurant'
  | 'craft'
  | 'shop'
  | 'meeting';

/** The kind of place, from its category and its name (English or Arabic). */
export function guideKind(place: GuidePlace): GuideKind {
  const en = place.nameEn;
  const ar = place.nameAr;
  const has = (re: RegExp, reAr?: RegExp) => re.test(en) || (!!reAr && reAr.test(ar));
  switch (place.category) {
    case 'coffee':
      return 'coffee';
    case 'restaurant':
      return 'restaurant';
    case 'workshop':
      return 'craft';
    case 'stationary':
      return 'shop';
    case 'meeting':
      return 'meeting';
  }
  // Mausoleums before mosques: a "Mosque and Mausoleum" is told as a tomb's story only when the name leads with it.
  if (has(/^[^(]*\b(mausoleum|tomb|dome|qubba|mashhad)\b/i, /^(ضريح|قبة|مشهد|مقام)/)) return 'mausoleum';
  if (isActiveMosque(place) || has(/\bmosque\b/i, /جامع|مسجد/)) return 'mosque';
  if (has(/\b(sabil|kuttab|madrasa|khanqah|complex|wikala|bimaristan)\b/i, /سبيل|كتاب|مدرسة|خانقاه|مجموعة|وكالة/)) return 'charity';
  if (has(/\b(church|monastery|cathedral|convent)\b/i, /كنيسة|دير/)) return 'church';
  if (has(/\bsynagogue\b/i, /معبد|كنيس/)) return 'synagogue';
  if (has(/\bmuseum\b/i, /متحف/)) return 'museum';
  if (has(/\b(house|palace|bayt|beit|qasr)\b/i, /بيت|قصر|منزل/)) return 'house';
  if (has(/\b(bab|gate|wall|street|citadel)\b/i, /باب|سور|شارع|قلعة/)) return 'gate';
  if (has(/\b(nilometer|aqueduct|bridge|canal)\b/i, /مقياس|سور مجرى|قناطر|كوبري/)) return 'water';
  return 'monument';
}

/** How many opening moves there are (their wording is in guide-style.ts). */
export const OPENING_COUNT = 6;

/** This place's opening move, by its ID, so neighbouring places of one kind start differently. */
export const openingIndex = (id: number) => ((id % OPENING_COUNT) + OPENING_COUNT) % OPENING_COUNT;

/**
 * What a place's recording is made from in this language, for its key and its
 * URL's version (audioVersion): the description, the place's kind and opening
 * move, and its name. Renaming or re-categorising a place therefore gives a
 * new URL, like editing its description. A change to the style text itself
 * (STYLE, OPENINGS) moves the prefix in audioVersion instead.
 */
export const narrationSource = (place: GuidePlace, lang: Lang, text: string) =>
  `${guideKind(place)}|${openingIndex(place.id)}|${nameOf(place, lang)}\n${text}`;
