// "Edit several places at once" in the Places tab: move them to another
// route, set their category, or turn Must-see on or off. Pure: it returns the
// new content and what changed, for the summary shown before saving.

import { categories, type Category } from '../data/locations';
import type { Content } from '../data/content';
import { STOP_CATEGORIES } from '../lib/walk';

export type BulkAction =
  | { kind: 'route'; routeId: string }
  | { kind: 'category'; category: Category }
  | { kind: 'mustSee'; on: boolean };

export type BulkResult = {
  content: Content;
  /** Places this changes. */
  changed: number;
  /** Selected places it leaves alone: already like that, or (Must-see) not a monument. */
  unchanged: number;
  notMonuments: number;
  /** "Move 4 places to Al-Muizz Street Route", for the summary and the History note. */
  summary: string;
};

const places = (n: number) => `${n} ${n === 1 ? 'place' : 'places'}`;

/**
 * Applies `action` to the places with these IDs. Moved places go to the end of
 * their new route's walking order (the end of the list), in the order they
 * had. A place that stops being a monument loses its Must-see tick, since only
 * monuments are stops.
 */
export function applyBulk(content: Content, ids: number[], action: BulkAction): BulkResult {
  const chosen = new Set(ids);
  const selected = content.places.filter(p => chosen.has(p.id));
  let changed = 0;
  let notMonuments = 0;
  let next = content.places;
  let summary = '';
  if (action.kind === 'route') {
    const route = content.routes.find(r => r.id === action.routeId);
    const moving = selected.filter(p => p.routeId !== action.routeId);
    changed = moving.length;
    const movingIds = new Set(moving.map(p => p.id));
    next = [...content.places.filter(p => !movingIds.has(p.id)), ...moving.map(p => ({ ...p, routeId: action.routeId }))];
    summary = `Move ${places(changed)} to ${route?.nameEn ?? action.routeId}`;
  } else if (action.kind === 'category') {
    const name = categories.find(c => c.id === action.category)?.nameEn ?? action.category;
    next = content.places.map(p => {
      if (!chosen.has(p.id) || p.category === action.category) return p;
      changed++;
      const { mustSee: _, ...rest } = p;
      return STOP_CATEGORIES.has(action.category) ? { ...p, category: action.category } : { ...rest, category: action.category };
    });
    summary = `Set ${places(changed)} to ${name}`;
  } else {
    next = content.places.map(p => {
      if (!chosen.has(p.id)) return p;
      if (!STOP_CATEGORIES.has(p.category)) {
        notMonuments++;
        return p;
      }
      if (!!p.mustSee === action.on) return p;
      changed++;
      const { mustSee: _, ...rest } = p;
      return action.on ? { ...p, mustSee: true } : rest;
    });
    summary = `Turn Must-see ${action.on ? 'on' : 'off'} for ${places(changed)}`;
  }
  return { content: { ...content, places: next }, changed, unchanged: selected.length - changed - notMonuments, notMonuments, summary };
}
