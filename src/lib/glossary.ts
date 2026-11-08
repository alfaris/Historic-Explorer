// Architecture terms in place descriptions (mihrab, sabil-kuttab, iwan…):
// the first use of each in a description is linked to a one-line
// explanation. Pure functions, shared by the app, the admin, the server's
// validation and the tests. The terms live with the content, so they work
// offline; content saved before the glossary existed uses DEFAULT_GLOSSARY.

import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang } from '../i18n/lang.js';
import { normalizeDrafted } from './drafted.js';

export interface GlossaryTerm {
  /** Lowercase letters, numbers and dashes, e.g. "sabil-kuttab". */
  id: string;
  termEn: string;
  termAr: string;
  termFr?: string;
  termEs?: string;
  /** One line explaining it. French and Spanish fall back to English. */
  defEn: string;
  defAr: string;
  defFr?: string;
  defEs?: string;
  /**
   * The spellings to find in descriptions, in any language (e.g. "sabil",
   * "sebil", "سبيل"). Matching ignores case, accents, Arabic vowel marks and
   * letter variants, and allows "al-"-style Arabic prefixes and plural endings.
   */
  match: string[];
  /** Fields Gemini drafted that no one has checked yet (admin only). See drafted.ts. */
  drafted?: string[];
}

export const GLOSSARY_LIMITS = { terms: 100, term: 60, def: 300, matches: 12, matchMin: 3 };

// --- Folding text for matching ----------------------------------------------

// The same folding as search (search.ts), one character at a time, so each
// folded character remembers where it came from in the original text.
const foldChar = (c: string) =>
  c
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, ' ');

/** Folded text, with each folded character's start and end in the original. */
function fold(text: string): { folded: string; start: number[]; end: number[] } {
  let folded = '';
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const c of text) {
    for (const f of foldChar(c)) {
      // Collapse runs of separators to one space.
      if (f === ' ' && (folded === '' || folded.endsWith(' '))) continue;
      folded += f;
      start.push(i);
      end.push(i + c.length);
    }
    i += c.length;
  }
  return { folded, start, end };
}

export const foldTerm = (s: string) => fold(s).folded.trim();

const ARABIC = /[؀-ۿ]/;
// What may come before an Arabic term in the same word ("المحراب", "والمئذنة"), and after it.
const AR_PREFIXES = new Set(['', 'ال', 'وال', 'بال', 'فال', 'كال', 'لل', 'و', 'ب', 'ل', 'ف']);
const AR_SUFFIXES = new Set(['', 'ه', 'ين', 'ون', 'ات', 'يه', 'يين', 'ي']);
// Plurals and the like in English, French and Spanish ("madrasas", "minaretes").
const LATIN_SUFFIXES = new Set(['', 's', 'es', 'e', 'en']);

export type GlossarySegment = string | { text: string; term: GlossaryTerm };

/**
 * Splits a description into plain text and the first use of each glossary
 * term. Where uses overlap, the earlier (then the longer) one wins, so
 * "sabil-kuttab" beats "sabil" and "kuttab".
 */
export function glossarySegments(text: string, terms: GlossaryTerm[]): GlossarySegment[] {
  if (!text || !terms.length) return text ? [text] : [];
  const { folded, start, end } = fold(text);
  const found: { from: number; to: number; term: GlossaryTerm }[] = [];
  for (const term of terms) {
    let best: { from: number; to: number } | null = null;
    for (const spelling of term.match.map(foldTerm).filter(s => s.length >= GLOSSARY_LIMITS.matchMin)) {
      const arabic = ARABIC.test(spelling);
      for (let at = folded.indexOf(spelling); at !== -1; at = folded.indexOf(spelling, at + 1)) {
        const wordStart = folded.lastIndexOf(' ', at - 1) + 1;
        const after = at + spelling.length;
        const space = folded.indexOf(' ', after);
        const wordEnd = space === -1 ? folded.length : space;
        const prefix = folded.slice(wordStart, at);
        const suffix = folded.slice(after, wordEnd);
        const ok = arabic ? AR_PREFIXES.has(prefix) && AR_SUFFIXES.has(suffix) : prefix === '' && LATIN_SUFFIXES.has(suffix);
        if (!ok) continue;
        if (!best || wordStart < best.from) best = { from: wordStart, to: wordEnd };
        break;
      }
    }
    if (best) found.push({ ...best, term });
  }
  found.sort((a, b) => a.from - b.from || b.to - a.to);
  const out: GlossarySegment[] = [];
  let cursor = 0; // in the original text
  let lastTo = -1; // in the folded text
  for (const f of found) {
    if (f.from < lastTo) continue;
    const from = start[f.from];
    const to = end[f.to - 1];
    if (from > cursor) out.push(text.slice(cursor, from));
    out.push({ text: text.slice(from, to), term: f.term });
    cursor = to;
    lastTo = f.to;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

// --- Picking the visitor's language -------------------------------------------

const field = (kind: 'term' | 'def', lang: Lang) => `${kind}${LANGUAGES[lang].suffix}` as const;

/** The term and its explanation in `lang` (French and Spanish fall back to English), and which language each is in. */
export function glossaryText(term: GlossaryTerm, lang: Lang) {
  const pick = (kind: 'term' | 'def') => {
    const own = (term[field(kind, lang)] ?? '').trim();
    return own ? { text: own, lang } : { text: term[field(kind, 'en')], lang: 'en' as Lang };
  };
  return { term: pick('term'), def: pick('def') };
}

// --- Content: normalising and checking ---------------------------------------

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Glossary from untrusted input, keeping only known fields. Undefined when it isn't a list. */
export function normalizeGlossary(input: unknown): GlossaryTerm[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.map((t: any): GlossaryTerm => {
    const optional = Object.fromEntries(
      OPTIONAL_LANGS.flatMap(l => [field('term', l), field('def', l)]).filter(k => str(t?.[k])).map(k => [k, str(t?.[k])]),
    );
    return {
      id: str(t?.id),
      termEn: str(t?.termEn),
      termAr: str(t?.termAr),
      defEn: str(t?.defEn),
      defAr: str(t?.defAr),
      ...optional,
      match: Array.isArray(t?.match) ? [...new Set(t.match.map(str).filter(Boolean) as string[])] : [],
      ...normalizeDrafted(t),
    };
  });
}

/** Problems with the glossary, for the admin's save check. Empty when valid. */
export function glossaryProblems(terms: GlossaryTerm[]): string[] {
  const problems: string[] = [];
  const L = GLOSSARY_LIMITS;
  if (terms.length > L.terms) problems.push(`Glossary: at most ${L.terms} terms.`);
  const ids = new Set<string>();
  for (const t of terms) {
    const label = `Glossary term "${t.termEn || t.id || '(unnamed)'}"`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) problems.push(`${label}: ID must be lowercase letters, numbers and dashes.`);
    else if (ids.has(t.id)) problems.push(`${label}: ID "${t.id}" is used twice.`);
    ids.add(t.id);
    if (!t.termEn) problems.push(`${label}: English term is empty.`);
    if (!ARABIC.test(t.termAr)) problems.push(`${label}: Arabic term is missing.`);
    if (!t.defEn) problems.push(`${label}: English explanation is empty.`);
    if (!ARABIC.test(t.defAr)) problems.push(`${label}: Arabic explanation is missing.`);
    for (const lang of LANGS) {
      if ((t[field('term', lang)] ?? '').length > L.term) problems.push(`${label}: ${field('term', lang)} is longer than ${L.term} characters.`);
      if ((t[field('def', lang)] ?? '').length > L.def) problems.push(`${label}: ${field('def', lang)} is longer than ${L.def} characters.`);
    }
    if (!t.match.length) problems.push(`${label}: add at least one spelling to look for.`);
    if (t.match.length > L.matches) problems.push(`${label}: at most ${L.matches} spellings.`);
    for (const m of t.match) {
      if (foldTerm(m).length < L.matchMin) problems.push(`${label}: the spelling "${m}" is too short (at least ${L.matchMin} letters).`);
      if (m.length > L.term) problems.push(`${label}: the spelling "${m.slice(0, 20)}…" is longer than ${L.term} characters.`);
    }
  }
  return problems;
}
