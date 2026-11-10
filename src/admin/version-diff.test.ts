import { describe, expect, it } from 'vitest';
import { changeCount, shortValue, TEXT_MAX, versionDiff } from './version-diff';
import { bundledContent, normalizeContent, type Content } from '../data/content';

const base = (): Content => normalizeContent(structuredClone(bundledContent));

describe('versionDiff', () => {
  it('finds nothing between identical versions', () => {
    expect(versionDiff(base(), base())).toEqual([]);
  });

  it('lists added and deleted places', () => {
    const a = base();
    const b = base();
    const gone = b.places.shift()!;
    b.places.push({ ...gone, id: 999, nameEn: 'New Café' });
    const [places] = versionDiff(a, b);
    expect(places.section).toBe('Places');
    expect(places.items).toEqual([
      { kind: 'added', name: 'New Café (ID 999)' },
      { kind: 'deleted', name: `${gone.nameEn} (ID ${gone.id})` },
    ]);
  });

  it('lists the edited fields with old and new text, shortening long text', () => {
    const a = base();
    const b = base();
    b.places[0] = { ...b.places[0], nameEn: 'Renamed', descriptionEn: 'x'.repeat(300), feeEn: 'EGP 60' };
    const edit = versionDiff(a, b)[0].items[0];
    expect(edit.kind).toBe('edited');
    if (edit.kind !== 'edited') return;
    expect(edit.name).toBe(`Renamed (ID ${a.places[0].id})`);
    expect(edit.fields.find(f => f.field === 'nameEn')).toEqual({ field: 'nameEn', before: a.places[0].nameEn, after: 'Renamed' });
    expect(edit.fields.find(f => f.field === 'descriptionEn')!.after).toHaveLength(TEXT_MAX);
    expect(edit.fields.find(f => f.field === 'feeEn')).toEqual({ field: 'feeEn', before: '(empty)', after: 'EGP 60' });
    expect(edit.movedMeters).toBeUndefined();
  });

  it('shows a moved pin as a distance, not as latitude and longitude', () => {
    const a = base();
    const b = base();
    b.places[0] = { ...b.places[0], lat: b.places[0].lat + 0.0004 };
    const edit = versionDiff(a, b)[0].items[0];
    expect(edit).toMatchObject({ kind: 'edited', fields: [] });
    if (edit.kind === 'edited') expect(edit.movedMeters).toBeGreaterThan(40);
  });

  it('covers routes, glossary terms, special hours, notices and the help sheet', () => {
    const a = base();
    const b: Content = {
      ...base(),
      notices: [{ textEn: 'Closed for works', textAr: 'مغلق' }],
      specialPeriods: [{ id: 'eid', nameEn: 'Eid', nameAr: 'العيد', from: '2027-03-10', to: '2027-03-12', places: { [a.places[0].id]: { closed: true } } }] as Content['specialPeriods'],
    };
    b.routes[0] = { ...b.routes[0], nameEn: 'Renamed route' };
    const diff = versionDiff(a, b);
    expect(diff.map(s => s.section)).toEqual(['Routes', 'Special hours', 'Notices']);
    expect(diff.find(s => s.section === 'Notices')!.items).toEqual([{ kind: 'added', name: 'Closed for works' }]);
    expect(changeCount(diff)).toBe(3);
    // The other way round: what restoring the older one would change.
    expect(versionDiff(b, a).find(s => s.section === 'Notices')!.items).toEqual([{ kind: 'deleted', name: 'Closed for works' }]);
  });
});

describe('shortValue', () => {
  it('writes empty, text, numbers and objects', () => {
    expect(shortValue(undefined)).toBe('(empty)');
    expect(shortValue('')).toBe('(empty)');
    expect(shortValue(3)).toBe('3');
    expect(shortValue(true)).toBe('true');
    expect(shortValue({ toilets: true })).toBe('{"toilets":true}');
  });
});
