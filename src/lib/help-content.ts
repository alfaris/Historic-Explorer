// The Help sheet's own content, edited in the admin: local contacts (a guide,
// a hotel), extra tips and extra phrases to show in Arabic. The emergency
// numbers are fixed in the app (help.ts). Pure; shared by the app, the admin
// and the server.

import { LANGS, LANGUAGES, OPTIONAL_LANGS } from '../i18n/lang.js';
import { normalizeDrafted } from './drafted.js';

export interface HelpContact {
  nameEn: string;
  nameAr: string;
  nameFr?: string;
  nameEs?: string;
  /** As written ("+20 100 123 4567"); called with the digits only. */
  phone: string;
  drafted?: string[];
}
export interface HelpTip {
  textEn: string;
  textAr: string;
  textFr?: string;
  textEs?: string;
  drafted?: string[];
}
export interface HelpPhrase {
  /** Shown large, to someone who reads Arabic. */
  ar: string;
  /** What it says, for the visitor (no Arabic: the phrase itself is). */
  meaningEn: string;
  meaningFr?: string;
  meaningEs?: string;
  drafted?: string[];
}
export interface HelpContent {
  contacts: HelpContact[];
  tips: HelpTip[];
  phrases: HelpPhrase[];
}

export const HELP_LIMITS = { items: 5, name: 60, phone: 20, tip: 200, phrase: 150 };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const optional = (o: any, base: string) =>
  Object.fromEntries(OPTIONAL_LANGS.map(l => `${base}${LANGUAGES[l].suffix}`).filter(k => str(o?.[k])).map(k => [k, str(o[k])]));
const list = (v: unknown) => (Array.isArray(v) ? v : []);

/** The Help content from untrusted input, typed and trimmed; undefined when there's none. */
export function normalizeHelp(input: unknown): HelpContent | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const help: HelpContent = {
    contacts: list(raw.contacts).map((c: any) => ({ nameEn: str(c?.nameEn), nameAr: str(c?.nameAr), ...optional(c, 'name'), phone: str(c?.phone), ...normalizeDrafted(c) })),
    tips: list(raw.tips).map((t: any) => ({ textEn: str(t?.textEn), textAr: str(t?.textAr), ...optional(t, 'text'), ...normalizeDrafted(t) })),
    phrases: list(raw.phrases).map((p: any) => ({ ar: str(p?.ar), meaningEn: str(p?.meaningEn), ...optional(p, 'meaning'), ...normalizeDrafted(p) })),
  };
  return help.contacts.length || help.tips.length || help.phrases.length ? help : undefined;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
/** A phone number to call: digits, an optional leading +, spaces, dashes and brackets; at least 3 digits. */
export const isPhone = (s: string) => /^\+?[\d\s()-]{3,20}$/.test(s) && (s.match(/\d/g) ?? []).length >= 3;
/** The tel: link for a number as written. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Problems with the Help content, for the save check. Empty when valid. */
export function helpProblems(help: HelpContent): string[] {
  const L = HELP_LIMITS;
  const problems: string[] = [];
  const tooLong = (label: string, o: Record<string, unknown>, base: string, max: number) => {
    for (const l of LANGS) {
      const k = `${base}${LANGUAGES[l].suffix}`;
      if (String(o[k] ?? '').length > max) problems.push(`${label}: ${k} is longer than ${max} characters.`);
    }
  };
  for (const [name, items] of [['contacts', help.contacts], ['tips', help.tips], ['phrases', help.phrases]] as const) {
    if (items.length > L.items) problems.push(`Help: at most ${L.items} ${name}.`);
  }
  help.contacts.forEach((c, i) => {
    const label = `Help contact ${i + 1}${c.nameEn ? ` "${c.nameEn}"` : ''}`;
    if (!c.nameEn) problems.push(`${label}: English name is empty.`);
    if (!hasArabic(c.nameAr)) problems.push(`${label}: Arabic name is missing.`);
    if (!isPhone(c.phone)) problems.push(`${label}: the phone number should be digits (with an optional +, spaces or dashes).`);
    tooLong(label, c as unknown as Record<string, unknown>, 'name', L.name);
  });
  help.tips.forEach((t, i) => {
    const label = `Help tip ${i + 1}`;
    if (!t.textEn) problems.push(`${label}: English text is empty.`);
    if (!hasArabic(t.textAr)) problems.push(`${label}: Arabic text is missing.`);
    tooLong(label, t as unknown as Record<string, unknown>, 'text', L.tip);
  });
  help.phrases.forEach((p, i) => {
    const label = `Help phrase ${i + 1}`;
    if (!hasArabic(p.ar)) problems.push(`${label}: the Arabic phrase is missing.`);
    if (p.ar.length > L.phrase) problems.push(`${label}: the Arabic phrase is longer than ${L.phrase} characters.`);
    if (!p.meaningEn) problems.push(`${label}: its English meaning is empty.`);
    tooLong(label, p as unknown as Record<string, unknown>, 'meaning', L.phrase);
  });
  return problems;
}
