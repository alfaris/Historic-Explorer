// How each place's audio guide is told. Without this every narration came out
// in the same voice and opened with the same line ("Imagine…"). The kind of
// place (guide-kind.ts) sets the tone and how the guide opens (a mosque isn't
// a mausoleum, a café isn't a city gate), and each place gets one of several
// opening moves, picked by its ID, so neighbouring stops of the same kind
// still start differently. Pure; the server builds the narration prompt from it.

import { guideKind, openingIndex, OPENING_COUNT, type GuideKind, type GuidePlace } from './guide-kind.js';

export { guideKind, narrationSource, type GuideKind } from './guide-kind.js';

/** Tone and how to open, for each kind of place. */
const STYLE: Record<GuideKind, { tone: string; open: string }> = {
  mosque: {
    tone: 'Calm and respectful: this is a living place of prayer.',
    open: 'Open with something of the mosque itself: its light, its courtyard, its minaret, the call to prayer, or the person who founded it and why.',
  },
  mausoleum: {
    tone: 'Quiet and reverent, like speaking softly beside a tomb.',
    open: 'Open with the person buried here: who they were, a moment from their life, or why people still come to visit them.',
  },
  charity: {
    tone: 'Warm, about everyday life and generosity in old Cairo.',
    open: 'Open with the people it served: thirsty passers-by drinking at the window, children reciting their lessons, students or Sufis living here, and the patron who paid for it.',
  },
  church: {
    tone: 'Gentle and contemplative, with the weight of very old faith.',
    open: 'Open with the community that has prayed here for centuries, or a saint or legend tied to this spot.',
  },
  synagogue: {
    tone: 'Gentle and curious, about a community and its memory.',
    open: 'Open with the legend or the treasure of documents tied to this place, or the community that kept it.',
  },
  house: {
    tone: 'Intimate and lively, as if showing a guest around a home.',
    open: 'Open by inviting the listener inside: a room, a window screen, a courtyard, or the family who lived here and how they lived.',
  },
  museum: {
    tone: 'Inviting and curious.',
    open: 'Open with one object or story from inside that makes the listener want to go in.',
  },
  gate: {
    tone: 'Vivid and energetic, full of movement.',
    open: 'Open with who passed through or along here: soldiers, caravans, processions, merchants, and what happened here.',
  },
  water: {
    tone: 'Clear and fascinating, about how Cairo lived with the Nile.',
    open: 'Open with what it measured, carried or connected, and why the city depended on it.',
  },
  monument: {
    tone: 'Captivating and a little dramatic.',
    open: 'Open with the most striking detail or moment in its story.',
  },
  coffee: {
    tone: 'Relaxed and friendly, like a local inviting you to sit down.',
    open: 'Open with the atmosphere: the sounds, the tea and coffee, the regulars, and what to order.',
  },
  restaurant: {
    tone: 'Warm and appetising.',
    open: 'Open with the food: the signature dish, how it is made, and how locals eat it.',
  },
  craft: {
    tone: 'Lively and hands-on.',
    open: 'Open with the craft: the sound of the tools, the hands at work, and how long this trade has been here.',
  },
  shop: {
    tone: 'Friendly and practical.',
    open: 'Open with what the shop sells and who comes here for it.',
  },
  meeting: {
    tone: 'Clear and welcoming, like a guide gathering the group.',
    open: 'Open by orienting the listener: where they are, what is around them, and where the walk goes from here.',
  },
};

/** Opening moves; each place uses one, picked by its ID, so places of one kind don't all start alike. */
export const OPENINGS = [
  'Start with a question to the listener.',
  'Start with a specific year, number or measurement.',
  'Start with a named person from its story.',
  'Start with something the listener can see right now, and tell them where to look.',
  'Start with a sound, smell or feeling of the place.',
  'Start with its most surprising fact.',
] as const;
if (OPENINGS.length !== OPENING_COUNT) throw new Error('OPENING_COUNT must match OPENINGS');

/** Stock openings the narrations kept using; the guide is told never to start with them. */
export const BANNED_OPENINGS = ['Imagine', 'Welcome', 'Close your eyes', 'Step back in time', 'Picture this', 'As you stand', 'Listen', 'تخيل', 'أهلاً', 'مرحباً', 'أغمض عينيك'];

/** The opening move for this place. */
export const openingFor = (id: number) => OPENINGS[openingIndex(id)];

/**
 * The narration brief for this place: its name and kind, the tone and opening
 * to use, and the openings to avoid. Part of the audio's storage key, so a
 * change here (or to the place's name or category) makes fresh audio.
 */
export function guideBrief(place: GuidePlace, name: string): string {
  const kind = guideKind(place);
  const { tone, open } = STYLE[kind];
  return [
    `The place: ${name} (${kind}).`,
    `Tone: ${tone}`,
    `Opening: ${open} ${openingFor(place.id)}`,
    `Never begin with these or their translations: ${BANNED_OPENINGS.map(o => `"${o}"`).join(', ')}. Do not begin by greeting the listener or by saying the place's name.`,
  ].join('\n');
}

