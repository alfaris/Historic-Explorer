import { describe, expect, it } from 'vitest';
import { applyBulk } from './bulk-edit';
import { bundledContent, normalizeContent, type Content } from '../data/content';
import { walkStops } from '../lib/walk';

const base = (): Content => normalizeContent(structuredClone(bundledContent));

describe('applyBulk: move to route', () => {
  it("moves the places to the end of the new route's walking order, in their order", () => {
    const c = base();
    const [a, b] = walkStops(c.places, 'ahl-al-bayt');
    const before = walkStops(c.places, 'al-muizz').map(p => p.id);
    const r = applyBulk(c, [b.id, a.id], { kind: 'route', routeId: 'al-muizz' });
    expect(r.changed).toBe(2);
    expect(r.summary).toBe('Move 2 places to Al-Muizz Street Route');
    expect(walkStops(r.content.places, 'al-muizz').map(p => p.id)).toEqual([...before, a.id, b.id]);
    expect(walkStops(r.content.places, 'ahl-al-bayt').map(p => p.id)).not.toContain(a.id);
    expect(r.content.places).toHaveLength(c.places.length);
  });

  it('leaves places already on that route alone', () => {
    const c = base();
    const [a] = walkStops(c.places, 'al-muizz');
    const r = applyBulk(c, [a.id], { kind: 'route', routeId: 'al-muizz' });
    expect([r.changed, r.unchanged]).toEqual([0, 1]);
    expect(r.content.places).toEqual(c.places);
  });
});

describe('applyBulk: category', () => {
  it('sets the category, and drops Must-see from places that stop being monuments', () => {
    const c = base();
    const [a, b] = walkStops(c.places, 'ahl-al-bayt');
    c.places = c.places.map(p => (p.id === a.id ? { ...p, mustSee: true } : p));
    const cafe = c.places.find(p => p.category === 'coffee')!;
    const r = applyBulk(c, [a.id, b.id, cafe.id], { kind: 'category', category: 'coffee' });
    expect([r.changed, r.unchanged]).toEqual([2, 1]);
    expect(r.summary).toBe('Set 2 places to Coffee Shops');
    const moved = r.content.places.find(p => p.id === a.id)!;
    expect(moved.category).toBe('coffee');
    expect(moved).not.toHaveProperty('mustSee');
  });
});

describe('applyBulk: Must-see', () => {
  it('ticks monuments only, counting the rest', () => {
    const c = base();
    const [a, b] = walkStops(c.places, 'ahl-al-bayt');
    const cafe = c.places.find(p => p.category === 'coffee')!;
    const r = applyBulk(c, [a.id, b.id, cafe.id], { kind: 'mustSee', on: true });
    expect([r.changed, r.unchanged, r.notMonuments]).toEqual([2, 0, 1]);
    expect(r.summary).toBe('Turn Must-see on for 2 places');
    expect(r.content.places.filter(p => p.mustSee).map(p => p.id)).toEqual([a.id, b.id]);
    expect(r.content.places.find(p => p.id === cafe.id)).not.toHaveProperty('mustSee');
    const off = applyBulk(r.content, [a.id, b.id], { kind: 'mustSee', on: false });
    expect(off.changed).toBe(2);
    expect(off.content.places.some(p => p.mustSee)).toBe(false);
  });
});
