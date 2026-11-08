import { describe, expect, it } from 'vitest';
import { normalizeContent, validateContent, bundledContent } from '../data/content';
import { LANGS } from '../i18n/lang';
import { builtLabel, builtProblems, ERAS, eraForYear, eraOf, normalizeBuilt, timeline, yearsText } from './eras';

describe('eras', () => {
  it('are in date order and named in every language', () => {
    expect(ERAS.map(e => e.from)).toEqual([...ERAS.map(e => e.from)].sort((a, b) => a - b));
    for (const e of ERAS) for (const l of LANGS) expect(e.names[l]).toBeTruthy();
  });

  it('guesses the era of a year', () => {
    expect(eraForYear(642)).toBe('early-islamic');
    expect(eraForYear(879)).toBe('tulunid');
    expect(eraForYear(970)).toBe('fatimid');
    expect(eraForYear(1356)).toBe('mamluk');
    expect(eraForYear(1250)).toBe('mamluk');
    expect(eraForYear(1249)).toBe('ayyubid');
    expect(eraForYear(1848)).toBe('modern');
    expect(eraForYear(300)).toBe('roman');
  });

  it("uses the era set, or the build year's", () => {
    expect(eraOf({ era: 'ottoman', builtFrom: 1356 })).toBe('ottoman');
    expect(eraOf({ builtFrom: 1356 })).toBe('mamluk');
    expect(eraOf({})).toBeNull();
  });
});

describe('normalizeBuilt', () => {
  it('keeps well-formed fields, from numbers or form strings', () => {
    expect(normalizeBuilt({ era: 'mamluk', builtFrom: '1356', builtTo: 1363 })).toEqual({ era: 'mamluk', builtFrom: 1356, builtTo: 1363 });
    expect(normalizeBuilt({ builtFrom: 1356, builtTo: 1356 })).toEqual({ builtFrom: 1356 });
  });
  it('drops unknown eras, non-integers and a "to" with no "from"', () => {
    expect(normalizeBuilt({ era: 'viking', builtFrom: 13.5, builtTo: 1400 })).toEqual({});
    expect(normalizeBuilt({ builtFrom: '', builtTo: '1363' })).toEqual({});
    expect(normalizeBuilt(null)).toEqual({});
  });
});

describe('builtProblems', () => {
  it('checks the years', () => {
    expect(builtProblems({ builtFrom: 1356, builtTo: 1363 })).toEqual([]);
    expect(builtProblems({ builtFrom: 0 })).toHaveLength(1);
    expect(builtProblems({ builtFrom: 1363, builtTo: 1356 })).toEqual(['"built until" is before the build year.']);
    expect(builtProblems({ builtFrom: 1356, builtTo: 3000 })).toHaveLength(1);
  });

  it('is part of the content check, and the bundled content still passes', () => {
    const c = normalizeContent(structuredClone(bundledContent));
    expect(validateContent(c)).toEqual([]);
    c.places[0] = { ...c.places[0], builtFrom: 1363, builtTo: 1356 };
    expect(validateContent(c).join(' ')).toContain('"built until" is before the build year.');
  });

  it('survives normalizeContent', () => {
    const c = structuredClone(bundledContent);
    Object.assign(c.places[0], { era: 'tulunid', builtFrom: 876, builtTo: 879 });
    expect(normalizeContent(c).places[0]).toMatchObject({ era: 'tulunid', builtFrom: 876, builtTo: 879 });
  });
});

describe('labels', () => {
  const sultan = { era: 'mamluk' as const, builtFrom: 1356, builtTo: 1363 };
  it('reads naturally in each language', () => {
    expect(builtLabel(sultan, 'en')).toBe('Built 1356–1363 · Mamluk');
    expect(builtLabel(sultan, 'ar')).toBe('بُني بين 1356 و1363 · العصر المملوكي');
    expect(builtLabel(sultan, 'fr')).toBe('Construit de 1356 à 1363 · Époque mamelouke');
    expect(builtLabel(sultan, 'es')).toBe('Construido entre 1356 y 1363 · Época mameluca');
    expect(builtLabel({ builtFrom: 879 }, 'en')).toBe('Built 879');
    expect(builtLabel({ era: 'fatimid' }, 'en')).toBe('Fatimid');
    expect(builtLabel({}, 'en')).toBeNull();
    expect(yearsText(sultan)).toBe('1356–1363');
    expect(yearsText({ era: 'fatimid' })).toBeNull();
  });
});

describe('timeline', () => {
  const places = [
    { id: 1, name: 'Sultan Hassan', era: 'mamluk' as const, builtFrom: 1356 },
    { id: 2, name: 'Ibn Tulun', builtFrom: 876 },
    { id: 3, name: 'Al-Aqmar', era: 'fatimid' as const, builtFrom: 1125 },
    { id: 4, name: 'Al-Azhar', era: 'fatimid' as const, builtFrom: 970 },
    { id: 5, name: 'A café' },
    { id: 6, name: 'Bab Zuweila', era: 'fatimid' as const },
  ];
  it('groups by era, oldest first, in date order, undated last, leaving out places with neither', () => {
    const groups = timeline(places, p => p.name);
    expect(groups.map(g => g.era.id)).toEqual(['tulunid', 'fatimid', 'mamluk']);
    expect(groups[1].places.map(p => p.name)).toEqual(['Al-Azhar', 'Al-Aqmar', 'Bab Zuweila']);
    expect(groups.flatMap(g => g.places).some(p => p.id === 5)).toBe(false);
  });
});
