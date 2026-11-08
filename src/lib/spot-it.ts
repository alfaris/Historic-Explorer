// "Spot it": a small find-this challenge at a stop, for children walking with
// their parents ("Find the carved shell above the door. How many ribs?"),
// with an optional answer. Which ones were found is kept on the device.

import type { Location } from '../data/locations';
import { LANGS, optionalText, type Lang } from '../i18n/lang';
import { createIdSetStore } from './id-set-store';
import { walkStops } from './walk';

/** Challenges found on this device, by place ID. */
export const spotted = createIdSetStore('cairo-walks:spotted');

type Spot = { text: string; lang: 'en' | undefined };

/** A place's challenge and answer in the visitor's language (English when not translated); null without one. */
export function spotOf(place: Location, lang?: Lang): { question: Spot; answer: Spot | null } | null {
  const question = optionalText(place, 'spot', lang);
  if (!question.text.trim()) return null;
  const answer = optionalText(place, 'spotAnswer', lang);
  return { question, answer: answer.text.trim() ? answer : null };
}

/** A route's challenges and how many were found, in walking order. */
export function spotCount(places: Location[], routeId: string, found: Set<number>): { found: number; total: number } {
  // Any language counts: an Arabic-only challenge still shows in Arabic.
  const withSpot = walkStops(places, routeId).filter(p => LANGS.some(l => !!spotOf(p, l)));
  return { found: withSpot.filter(p => found.has(p.id)).length, total: withSpot.length };
}
