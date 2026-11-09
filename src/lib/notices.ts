// Notices: short announcements the admin posts for visitors ("The minarets of
// Bab Zuweila are closed for restoration", "Street market on Friday, very
// crowded"). Each shows app-wide, on one route or on one place, optionally
// between two Cairo dates. Pure; shared by the app, the admin and the server.

import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang } from '../i18n/lang.js';
import { normalizeDrafted } from './drafted.js';
import { isDate } from './special-hours.js';
import { textHash } from './text-hash.js';

export interface Notice {
  textEn: string;
  textAr: string;
  textFr?: string;
  textEs?: string;
  /** First and last Cairo day it shows (YYYY-MM-DD), each optional. */
  from?: string;
  until?: string;
  /** Where it shows: one route, one place, or (neither) everywhere. */
  routeId?: string;
  placeId?: number;
  /** A safety notice: shown first, and can't be dismissed. */
  important?: boolean;
  drafted?: string[];
}

export const NOTICE_LIMITS = { notices: 10, text: 240 };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** The notices from untrusted input, typed and trimmed; undefined when there are none. */
export function normalizeNotices(input: unknown): Notice[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const notices = input.map((n: any): Notice => {
    const placeId = Number(n?.placeId);
    return {
      textEn: str(n?.textEn),
      textAr: str(n?.textAr),
      ...Object.fromEntries(OPTIONAL_LANGS.map(l => `text${LANGUAGES[l].suffix}`).filter(k => str(n?.[k])).map(k => [k, str(n[k])])),
      ...(str(n?.from) ? { from: str(n.from) } : {}),
      ...(str(n?.until) ? { until: str(n.until) } : {}),
      ...(str(n?.routeId) ? { routeId: str(n.routeId) } : Number.isInteger(placeId) && placeId > 0 ? { placeId } : {}),
      ...(n?.important === true ? { important: true } : {}),
      ...normalizeDrafted(n),
    };
  });
  return notices.length ? notices : undefined;
}

const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Problems with the notices, for the save check. Empty when valid. */
export function noticeProblems(notices: Notice[], routeIds: Set<string>, placeIds: Set<number>): string[] {
  const problems: string[] = [];
  if (notices.length > NOTICE_LIMITS.notices) problems.push(`Notices: at most ${NOTICE_LIMITS.notices}.`);
  notices.forEach((n, i) => {
    const label = `Notice ${i + 1}${n.textEn ? ` "${n.textEn.slice(0, 40)}"` : ''}`;
    if (!n.textEn) problems.push(`${label}: English text is empty.`);
    if (!hasArabic(n.textAr)) problems.push(`${label}: Arabic text is missing.`);
    for (const l of LANGS) {
      const k = `text${LANGUAGES[l].suffix}` as keyof Notice;
      if (String(n[k] ?? '').length > NOTICE_LIMITS.text) problems.push(`${label}: ${k} is longer than ${NOTICE_LIMITS.text} characters.`);
    }
    if (n.from !== undefined && !isDate(n.from)) problems.push(`${label}: the first day isn't a date.`);
    if (n.until !== undefined && !isDate(n.until)) problems.push(`${label}: the last day isn't a date.`);
    if (n.from && n.until && isDate(n.from) && isDate(n.until) && n.until < n.from) problems.push(`${label}: the last day is before the first.`);
    if (n.routeId !== undefined && !routeIds.has(n.routeId)) problems.push(`${label}: its route no longer exists.`);
    if (n.placeId !== undefined && !placeIds.has(n.placeId)) problems.push(`${label}: its place no longer exists.`);
  });
  return problems;
}

/** Whether the notice shows on this Cairo date. */
export const isActive = (n: Notice, date: string) => (!n.from || n.from <= date) && (!n.until || date <= n.until);
/** Whether its last day has passed (for the admin's checklist). */
export const isExpired = (n: Notice, date: string) => !!n.until && n.until < date;

export type NoticeScope = { app: true } | { routeId: string } | { placeId: number };

/** The notices showing today in one place on screen, important ones first. */
export function noticesFor(notices: Notice[] | undefined, date: string, scope: NoticeScope): Notice[] {
  const here = (n: Notice) =>
    'app' in scope ? n.routeId === undefined && n.placeId === undefined : 'routeId' in scope ? n.routeId === scope.routeId : n.placeId === scope.placeId;
  return (notices ?? []).filter(n => here(n) && isActive(n, date)).sort((a, b) => Number(!!b.important) - Number(!!a.important));
}

/**
 * What a dismissal remembers: a hash of the notice's text, dates and place,
 * so an edited notice shows again.
 */
export const noticeKey = (n: Notice) =>
  textHash([n.textEn, n.textAr, n.textFr ?? '', n.textEs ?? '', n.from ?? '', n.until ?? '', n.routeId ?? '', n.placeId ?? ''].join('|'));

/** The notice's text in the language, or English. */
export function noticeText(n: Notice, lang: Lang): { text: string; lang: 'en' | undefined } {
  const own = lang === 'ar' ? n.textAr : lang === 'en' ? n.textEn : (n[`text${LANGUAGES[lang].suffix}` as 'textFr' | 'textEs'] ?? '');
  if (own) return { text: own, lang: undefined };
  return { text: n.textEn, lang: 'en' };
}

/** Content whose notices on routes or places it no longer has are dropped (after a delete). */
export function withNoticesFor<C extends { routes: { id: string }[]; places: { id: number }[]; notices?: Notice[] }>(content: C): C {
  if (!content.notices) return content;
  const { notices: _, ...rest } = content;
  const notices = withoutMissing(content.notices, new Set(content.routes.map(r => r.id)), new Set(content.places.map(p => p.id)));
  return (notices ? { ...rest, notices } : rest) as C;
}

/** The notices kept when routes or places are deleted: those pointing at them go. */
export const withoutMissing = (notices: Notice[] | undefined, routeIds: Set<string>, placeIds: Set<number>) => {
  const kept = notices?.filter(n => (n.routeId === undefined || routeIds.has(n.routeId)) && (n.placeId === undefined || placeIds.has(n.placeId)));
  return kept?.length ? kept : undefined;
};
