import { describe, expect, it } from 'vitest';
import { bundledContent, nextPlaceId, normalizeContent, validateContent, type Content } from './content';
import { blockingProblems, withUniqueIds } from './content-repair';

describe('blockingProblems', () => {
  const c = normalizeContent(structuredClone(bundledContent));
  // A saved copy with one place outside Cairo and one bad photo address (a check added since).
  const stored = (): Content => {
    const s = structuredClone(c);
    s.places[0] = { ...s.places[0], lng: 3123 };
    s.places[1] = { ...s.places[1], photo: { ...s.places[1].photo!, src: 'https://old.example/a.jpg' } };
    return s;
  };
  it('allows valid content, and a save that keeps or removes older problems', () => {
    expect(blockingProblems(c, stored())).toEqual([]);
    const next = stored();
    next.places[5] = { ...next.places[5], nameEn: next.places[5].nameEn + ' (renamed)' };
    expect(blockingProblems(next, stored())).toEqual([]);
    next.places[0] = { ...next.places[0], lng: c.places[0].lng };
    expect(blockingProblems(next, stored())).toEqual([]);
  });
  it('refuses new places that repeat an older problem', () => {
    const next = stored();
    const extra = { ...next.places[0], id: nextPlaceId(next) };
    expect(blockingProblems({ ...next, places: [...next.places, extra] }, stored())).not.toEqual([]);
  });
  it('refuses a change to a flagged item that keeps it failing', () => {
    const next = stored();
    next.places[1] = { ...next.places[1], photo: { ...next.places[1].photo!, src: 'https://tracker.example/pixel.gif' } };
    expect(blockingProblems(next, stored())).not.toEqual([]);
    // Editing something else on it without fixing it is refused too.
    next.places[1] = { ...stored().places[1], nameEn: 'Other' };
    expect(blockingProblems(next, stored())).not.toEqual([]);
  });
  it('refuses a new problem, a changed section with problems, and content that can’t be shown', () => {
    const next = stored();
    next.places[3] = { ...next.places[3], nameEn: '' };
    expect(blockingProblems(next, stored())).not.toEqual([]);
    const notices = stored();
    notices.notices = [{ id: 'x', scope: 'route', target: 'nowhere' } as never];
    expect(blockingProblems(notices, stored())).not.toEqual([]);
    expect(blockingProblems({ ...stored(), places: [] }, stored())).not.toEqual([]);
  });
  it('names only the changed item’s problems', () => {
    const next = stored();
    next.places[1] = { ...next.places[1], nameEn: 'Other' };
    const blocking = blockingProblems(next, stored());
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every(p => p.startsWith('Place "Other"'))).toBe(true);
  });
  it('judges special hours, glossary and notices item by item', () => {
    const s = stored();
    const period = (id: string, nameEn: string, placeId: number) => ({ id, nameEn, nameAr: 'رمضان', from: '2027-02-01', to: '2027-03-01', places: { [placeId]: { closed: true } } });
    s.specialPeriods = [period('a', 'x'.repeat(200), c.places[3].id), period('b', 'Eid', c.places[4].id)] as never;
    expect(validateContent(s).some(p => p.startsWith('Special hours "xxx'))).toBe(true);
    // Changing the clean period B goes ahead although period A still has its older problem.
    const next = structuredClone(s);
    next.specialPeriods![1] = { ...next.specialPeriods![1], nameEn: 'Eid al-Fitr' };
    expect(blockingProblems(next, s)).toEqual([]);
    // Changing A without fixing it doesn't.
    next.specialPeriods![0] = { ...next.specialPeriods![0], to: '2027-03-02' };
    expect(blockingProblems(next, s)).not.toEqual([]);
  });
  it('lets a renumbered repeat that is otherwise unchanged keep its older problem', () => {
    const s = stored();
    s.places.push({ ...s.places[0] });
    const { content } = withUniqueIds(s);
    const next = { ...content, places: content.places.map((p, i) => (i === 5 ? { ...p, nameEn: p.nameEn + ' (renamed)' } : p)) };
    expect(blockingProblems(next, s)).toEqual([]);
  });
});

describe('withUniqueIds', () => {
  it('renumbers repeated place and route IDs after the first', () => {
    const c = normalizeContent(structuredClone(bundledContent));
    c.places[2] = { ...c.places[2], id: c.places[1].id };
    c.routes[1] = { ...c.routes[1], id: c.routes[0].id };
    const { content, changed } = withUniqueIds(c);
    expect(changed).toHaveLength(2);
    expect(new Set(content.places.map(p => p.id)).size).toBe(c.places.length);
    expect(content.places[2].id).toBe(nextPlaceId(c));
    expect(content.routes[1].id).toBe(`${c.routes[0].id}-2`);
    expect(validateContent(content).some(p => p.includes('used twice'))).toBe(false);
    // Deleting the renumbered place removes it alone.
    expect(content.places.filter(p => p.id !== content.places[2].id)).toHaveLength(c.places.length - 1);
  });
  it('never gives a repeat the ID of another route', () => {
    const c = normalizeContent(structuredClone(bundledContent));
    const [a, b, d] = c.routes;
    c.routes = [{ ...a, id: 'walk' }, { ...b, id: 'walk' }, { ...d, id: 'walk-2' }, ...c.routes.slice(3)];
    const { content } = withUniqueIds(c);
    expect(content.routes.slice(0, 3).map(r => r.id)).toEqual(['walk', 'walk-3', 'walk-2']);
  });
  it('returns the same content when nothing repeats', () => {
    const c = normalizeContent(structuredClone(bundledContent));
    expect(withUniqueIds(c).content).toBe(c);
  });
});

