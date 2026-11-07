// "Set hours for several places": the same weekly hours applied to many places
// in one save. Pure, so it's tested.

import type { Location } from '../data/content';
import type { OpeningHours } from '../lib/opening-hours';

const isNote = (k: string) => k.startsWith('note');

/**
 * `places` with `hours` set on those in `ids`. The days always come from
 * `hours`; a note is only replaced where `hours` has one in that language,
 * so each place keeps its own notes (e.g. "Closed for Friday prayers") otherwise.
 */
export function applyHours<T extends Pick<Location, 'id' | 'hours'>>(places: T[], ids: Set<number>, hours: OpeningHours): T[] {
  const newNotes = Object.fromEntries(Object.entries(hours).filter(([k, v]) => isNote(k) && typeof v === 'string' && v.trim()));
  return places.map(p => {
    if (!ids.has(p.id)) return p;
    const oldNotes = Object.fromEntries(Object.entries(p.hours ?? {}).filter(([k]) => isNote(k)));
    return { ...p, hours: { ...oldNotes, ...newNotes, days: hours.days.map(day => day.map(r => ({ ...r }))) } };
  });
}
