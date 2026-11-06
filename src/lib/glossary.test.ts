import { describe, expect, it } from 'vitest';
import { DEFAULT_GLOSSARY } from '../data/glossary';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { glossaryProblems, glossarySegments, glossaryText, normalizeGlossary, type GlossaryTerm } from './glossary';

const terms = DEFAULT_GLOSSARY;
const linked = (text: string, list: GlossaryTerm[] = terms) =>
  glossarySegments(text, list).flatMap(s => (typeof s === 'string' ? [] : [`${s.text}=${s.term.id}`]));

describe('glossarySegments', () => {
  it('links the first use of each term and keeps the text intact', () => {
    const text = 'Its mihrab is carved; the mihrab faces the minaret.';
    const segments = glossarySegments(text, terms);
    expect(segments.map(s => (typeof s === 'string' ? s : s.text)).join('')).toBe(text);
    expect(linked(text)).toEqual(['mihrab=mihrab', 'minaret=minaret']);
  });

  it('ignores case and accents, and allows plurals', () => {
    expect(linked('Two MADRASAS and a Mausolée.')).toEqual(['MADRASAS=madrasa', 'Mausolée=mausoleum']);
    expect(linked('Los alminares y los mocárabes.')).toEqual(['alminares=minaret', 'mocárabes=muqarnas']);
  });

  it('does not match inside other words', () => {
    expect(linked('Sabilah, waqfiya and minarettes.')).toEqual([]);
  });

  it('prefers the longer term where they overlap', () => {
    expect(linked('A fine sabil-kuttab stands here; another sabil is nearby.')).toEqual(['sabil-kuttab=sabil-kuttab']);
    expect(linked('A sabil kuttab.')).toEqual(['sabil kuttab=sabil-kuttab']);
  });

  it('matches Arabic with prefixes, vowel marks and letter variants', () => {
    expect(linked('ويتميز المِحْرَاب بزخارفه، وترتفع المئذنة فوق الضريح.')).toEqual([
      'المِحْرَاب=mihrab',
      'المئذنة=minaret',
      'الضريح=mausoleum',
    ]);
    expect(linked('بناه المماليك في العصر الفاطمي.')).toEqual(['المماليك=mamluk', 'الفاطمي=fatimid']);
    // A word that merely contains a term isn't linked.
    expect(linked('محرابان')).toEqual([]);
  });

  it('returns the text alone when nothing matches or there are no terms', () => {
    expect(glossarySegments('A quiet street.', terms)).toEqual(['A quiet street.']);
    expect(glossarySegments('A mihrab.', [])).toEqual(['A mihrab.']);
    expect(glossarySegments('', terms)).toEqual([]);
  });
});

describe('glossaryText', () => {
  it('falls back to English for a language without its own text', () => {
    const t = { ...terms[0], defFr: undefined };
    expect(glossaryText(t, 'fr').def).toEqual({ text: t.defEn, lang: 'en' });
    expect(glossaryText(t, 'ar').term).toEqual({ text: 'محراب', lang: 'ar' });
  });
});

describe('the glossary in content', () => {
  it('ships a valid built-in glossary, in all four languages', () => {
    expect(glossaryProblems(DEFAULT_GLOSSARY)).toEqual([]);
    for (const t of DEFAULT_GLOSSARY) expect([t.termFr, t.termEs, t.defFr, t.defEs].every(Boolean)).toBe(true);
  });

  it('keeps a saved glossary through normalizing, and leaves it out when there is none', () => {
    const saved = normalizeContent({ ...bundledContent, glossary: [{ ...terms[0], extra: 'x', match: ['mihrab', 'mihrab', ' '] }] });
    expect(saved.glossary?.[0].match).toEqual(['mihrab']);
    expect(saved.glossary?.[0]).not.toHaveProperty('extra');
    expect(normalizeContent(bundledContent).glossary).toBeUndefined();
    expect(normalizeGlossary('nope')).toBeUndefined();
  });

  it('refuses incomplete or risky terms', () => {
    const bad = [{ id: 'X', termEn: '', termAr: 'abc', defEn: 'd', defAr: 'شرح', match: ['ab'] }] as GlossaryTerm[];
    const problems = glossaryProblems(bad);
    expect(problems.some(p => p.includes('ID must be'))).toBe(true);
    expect(problems.some(p => p.includes('English term is empty'))).toBe(true);
    expect(problems.some(p => p.includes('Arabic term is missing'))).toBe(true);
    expect(problems.some(p => p.includes('too short'))).toBe(true);
    expect(validateContent({ ...bundledContent, glossary: bad }).length).toBeGreaterThan(0);
  });
});
