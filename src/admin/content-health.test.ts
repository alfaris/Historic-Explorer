import { describe, expect, it } from 'vitest';
import { bundledContent } from '../data/content';
import { walkPlan } from '../lib/walk';
import { placeGaps, plannedKm, plannedWalk, progress, routeGaps } from './content-health';

const place = bundledContent.places[0];

describe('placeGaps', () => {
  it('lists what a bundled place is missing', () => {
    // Place 1 has a built-in photo, but no hours and no French or Spanish yet.
    expect(placeGaps(place)).toEqual(['hours', 'fr', 'es']);
  });
  it('clears each gap once it is filled', () => {
    const full = {
      ...place,
      hours: { days: Array.from({ length: 7 }, () => []) },
      nameFr: 'Mosquée', descriptionFr: 'Description.',
      nameEs: 'Mezquita', descriptionEs: 'Descripción.',
    };
    expect(placeGaps(full)).toEqual([]);
    expect(placeGaps({ ...full, descriptionEs: '  ' })).toEqual(['es']);
  });
  it('needs a photo when there is neither an upload nor a built-in one', () => {
    expect(placeGaps({ ...place, id: 999_998 })).toContain('photo');
  });
  it('only asks for a translated description when there is an English one', () => {
    expect(placeGaps({ ...place, descriptionEn: '', nameFr: 'X', nameEs: 'Y' })).not.toContain('fr');
  });
});

describe('routeGaps', () => {
  it('bundled routes have French and Spanish', () => {
    for (const r of bundledContent.routes) expect(routeGaps(r)).toEqual([]);
  });
  it('a route missing Spanish highlights is missing Spanish', () => {
    expect(routeGaps({ ...bundledContent.routes[0], highlightsEs: [] })).toEqual(['es']);
  });
  it('a route without highlights only needs a translated name and description', () => {
    expect(routeGaps({ ...bundledContent.routes[0], highlightsEn: [], highlightsAr: [], highlightsFr: [], highlightsEs: [] })).toEqual([]);
  });
});

describe('progress', () => {
  it('counts places that have each item', () => {
    const p = progress(bundledContent);
    const total = bundledContent.places.length;
    expect(p.find(x => x.id === 'hours')).toEqual({ id: 'hours', label: 'Opening hours', done: 0, total });
    expect(p.find(x => x.id === 'es')!.done).toBe(0);
    const photos = p.find(x => x.id === 'photo')!;
    expect(photos.done).toBe(bundledContent.places.filter(pl => !placeGaps(pl).includes('photo')).length);
  });
});

describe('plannedWalk', () => {
  it('adds up the legs between a route’s stops', () => {
    const w = plannedWalk(bundledContent.places, 'ahl-al-bayt');
    const legs = [...walkPlan(bundledContent.places, 'ahl-al-bayt').values()].filter(i => i.leg);
    expect(w.stops).toBe(legs.length + 1);
    expect(w.meters).toBe(Math.round(legs.reduce((m, i) => m + i.leg!.meters, 0)));
    expect(plannedKm(w.meters)).toBeCloseTo(4.9, 0);
  });
  it('is zero for a route without stops', () => {
    expect(plannedWalk(bundledContent.places, 'nope')).toEqual({ meters: 0, minutes: 0, stops: 0 });
  });
  it('rounds to a tenth of a kilometre', () => {
    expect(plannedKm(4_870)).toBe(4.9);
    expect(plannedKm(949)).toBe(0.9);
  });
});
