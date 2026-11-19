// Visitor reports of wrong information, one small JSON file per report in
// Vercel Blob. Nothing identifying (IP, account) is stored with a report.

import { isLang, type Lang } from '../../src/i18n/lang.js';
import { randomUUID } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import { CAIRO_BOUNDS } from '../../src/data/content.js';
import { cleanClient, type Client } from '../../src/lib/stats.js';
import { getContent } from './content.js';
import { createRateLimiter } from './guard.js';
import { hasBlobStore, json, readJson } from './http.js';

export type ReportType = 'location' | 'text' | 'closed' | 'photo';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  createdAt: string;
  status: ReportStatus;
  type: ReportType;
  placeId: number;
  /** The place's English name when reported, in case it's later renamed or deleted. */
  placeName: string;
  message: string;
  suggested?: { lat: number; lng: number; source: 'gps' | 'map'; accuracy?: number };
  lang: Lang;
  /** Where it was sent from (the web, or a native app and its build), when the sender said. */
  client?: Client;
  appVersion?: number;
  adminNote?: string;
  updatedAt?: string;
}

const PREFIX = 'reports/';
const TYPES: ReportType[] = ['location', 'text', 'closed', 'photo'];
const MAX_MESSAGE = 1000;
const MAX_STORED = 5000;

// 5 reports per IP per 10 minutes.
const reportRateLimit = createRateLimiter(5, 10 * 60_000, 'Thanks! You’ve sent several reports. Please try again in a few minutes.');

const inBounds = (lat: number, lng: number) =>
  lat >= CAIRO_BOUNDS.minLat && lat <= CAIRO_BOUNDS.maxLat && lng >= CAIRO_BOUNDS.minLng && lng <= CAIRO_BOUNDS.maxLng;

/** Checks a submitted report. Returns the report to store, or an error message. */
export async function buildReport(input: any, now = new Date()): Promise<Report | string> {
  const type = input?.type;
  if (!TYPES.includes(type)) return 'Unknown report type.';
  const placeId = Number(input?.placeId);
  const place = (await getContent()).places.find(p => p.id === placeId);
  if (!place) return 'Unknown place.';
  const message = typeof input?.message === 'string' ? input.message.trim().slice(0, MAX_MESSAGE) : '';
  if ((type === 'text' || type === 'photo') && message.length < 3) return 'Please describe what’s wrong.';

  let suggested: Report['suggested'];
  if (type === 'location') {
    const lat = Number(input?.suggested?.lat);
    const lng = Number(input?.suggested?.lng);
    const source = input?.suggested?.source === 'gps' ? 'gps' : 'map';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBounds(lat, lng)) return 'Please choose the correct spot in Cairo.';
    const accuracy = Number(input?.suggested?.accuracy);
    suggested = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), source, ...(Number.isFinite(accuracy) ? { accuracy: Math.round(accuracy) } : {}) };
  }

  return {
    id: randomUUID(),
    createdAt: now.toISOString(),
    status: 'open',
    type,
    placeId,
    placeName: place.nameEn,
    message,
    ...(suggested ? { suggested } : {}),
    lang: isLang(input?.lang) ? input.lang : 'en',
    ...(cleanClient(input) ?? {}),
  };
}

// Reports are filed by status (reports/open/…, reports/resolved/…), so the
// dashboard can list and page through one status without reading the rest.
// The file name also carries the place and the kind of report
// (<time>_<id>_p<place>_<type>.json), so they can be filtered from the
// listing alone. Reports filed before that (<time>_<id>.json) are read once.
const STATUSES: ReportStatus[] = ['open', 'resolved', 'dismissed'];
const pathFor = (r: Pick<Report, 'id' | 'createdAt' | 'status' | 'placeId' | 'type'>) =>
  `${PREFIX}${r.status}/${r.createdAt.replace(/[:.]/g, '-')}_${r.id}_p${r.placeId}_${r.type}.json`;
const statusOf = (pathname: string) => pathname.slice(PREFIX.length).split('/')[0] as ReportStatus;
const fileName = (pathname: string) => pathname.slice(pathname.lastIndexOf('/') + 1);

/** What a report's file name says: its time key, ID, and (newer files) place and type. */
export function parseReportName(pathname: string): { key: string; id: string; placeId?: number; type?: ReportType } | null {
  const m = /^([^_]+)_([^_]+)(?:_p(\d+)_([a-z]+))?\.json$/.exec(fileName(pathname));
  if (!m) return null;
  const type = m[4] as ReportType | undefined;
  return m[3] && type && TYPES.includes(type) ? { key: m[1], id: m[2], placeId: Number(m[3]), type } : { key: m[1], id: m[2] };
}

export interface ReportFilter {
  /** Only reports about these places (a route's places, or one place). */
  placeIds?: number[];
  type?: ReportType;
}

export type ReportMeta = { placeId: number; type: ReportType };

export const matchesFilter = (meta: ReportMeta | null, filter: ReportFilter) =>
  (!filter.placeIds || (!!meta && filter.placeIds.includes(meta.placeId))) && (!filter.type || meta?.type === filter.type);

// Place and type of reports filed before they were in the name, by path (a
// moved report gets a new path). Kept while the function instance is warm.
// Only reports that were read are kept: one that failed is tried again next time.
const legacyMeta = new Map<string, ReportMeta>();

/** The place and type of each report, from its name, or by reading the older ones. */
async function metaFor(paths: string[]): Promise<Map<string, ReportMeta | null>> {
  const out = new Map<string, ReportMeta | null>();
  const unread: string[] = [];
  for (const p of paths) {
    const parsed = parseReportName(p);
    if (parsed?.placeId !== undefined && parsed.type) out.set(p, { placeId: parsed.placeId, type: parsed.type });
    else if (legacyMeta.has(p)) out.set(p, legacyMeta.get(p)!);
    else unread.push(p);
  }
  // Read a few at a time to stay well within Blob's rate limits.
  for (let i = 0; i < unread.length; i += 10) {
    const batch = await Promise.all(unread.slice(i, i + 10).map(readReport));
    batch.forEach((r, j) => {
      const meta = r ? { placeId: r.placeId, type: r.type } : null;
      if (meta) legacyMeta.set(unread[i + j], meta);
      out.set(unread[i + j], meta);
    });
  }
  return out;
}

async function listReportPaths(): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    paths.push(...page.blobs.map(b => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  // Newest first: file names start with the timestamp.
  return paths.filter(p => STATUSES.includes(statusOf(p))).sort((a, b) => fileName(b).localeCompare(fileName(a)));
}

async function readReport(pathname: string): Promise<Report | null> {
  const result = await get(pathname, { access: 'private', useCache: false }).catch(() => null);
  if (!result?.stream) return null;
  try {
    return JSON.parse(await new Response(result.stream).text()) as Report;
  } catch {
    return null;
  }
}

/** A report's file, with its ID and creation time taken from the file name. */
export type ReportRef = { id: string; key: string; pathname: string };

/** A time as it appears in report file names (sortable as text). */
export const reportTimeKey = (iso: string) => iso.replace(/[:.]/g, '-');

/**
 * Open reports created at or after `sinceKey` (see reportTimeKey), newest
 * first. Reads only the listing, not the reports. Used by the daily email.
 */
export async function openReportRefsSince(sinceKey: string): Promise<ReportRef[]> {
  return (await listReportPaths())
    .filter(p => statusOf(p) === 'open')
    .flatMap(pathname => {
      const parsed = parseReportName(pathname);
      return parsed ? [{ key: parsed.key, id: parsed.id, pathname }] : [];
    })
    .filter(r => r.key >= sinceKey);
}

/** Reads a report, throwing (rather than skipping) if it can't be read. */
export async function readReportOrThrow(pathname: string): Promise<Report> {
  const report = await readReport(pathname);
  if (!report) throw new Error(`Couldn’t read ${pathname}`);
  return report;
}

/** POST /api/report: a visitor reports a problem with a place. */
export async function handleReport(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const limited = reportRateLimit(request);
  if (limited) return limited;
  if (!hasBlobStore()) return json({ error: 'Reports aren’t available right now.' }, 503);

  const body = await readJson(request, 8_000);
  if (body instanceof Response) return body;
  // Bots fill in every field; people never see this one.
  if ((body as any)?.website) return json({ ok: true });

  const report = await buildReport(body);
  if (typeof report === 'string') return json({ error: report }, 400);

  if ((await listReportPaths()).length >= MAX_STORED) {
    return json({ error: 'We can’t take more reports right now. Please try again later.' }, 503);
  }
  await put(pathFor(report), JSON.stringify(report), { access: 'private', contentType: 'application/json' });
  return json({ ok: true, id: report.id }, 201);
}

/** How many open reports each place has, for the dashboard's place list. */
export async function openReportCounts(): Promise<Record<number, number>> {
  const open = (await listReportPaths()).filter(p => statusOf(p) === 'open');
  const meta = await metaFor(open);
  const counts: Record<number, number> = {};
  for (const p of open) {
    const m = meta.get(p);
    if (m) counts[m.placeId] = (counts[m.placeId] ?? 0) + 1;
  }
  return counts;
}

export interface ReportPage {
  reports: Report[];
  /** How many reports match the filter in total. */
  total: number;
  counts: Record<ReportStatus, number>;
}

/** One page of reports for the dashboard, newest first, with counts that follow the filter. */
export async function listReports(status: ReportStatus | 'all' = 'open', offset = 0, limit = 50, filter: ReportFilter = {}): Promise<ReportPage> {
  let all = await listReportPaths();
  if (filter.placeIds || filter.type) {
    const meta = await metaFor(all);
    all = all.filter(p => matchesFilter(meta.get(p) ?? null, filter));
  }
  const counts = { open: 0, resolved: 0, dismissed: 0 };
  for (const p of all) counts[statusOf(p)]++;
  const matching = status === 'all' ? all : all.filter(p => statusOf(p) === status);
  const paths = matching.slice(Math.max(0, offset), Math.max(0, offset) + Math.min(Math.max(1, limit), 100));
  const reports: Report[] = [];
  // Read a few at a time to stay well within Blob's rate limits.
  for (let i = 0; i < paths.length; i += 10) {
    const batch = await Promise.all(paths.slice(i, i + 10).map(readReport));
    reports.push(...batch.filter((r): r is Report => r !== null));
  }
  return { reports, total: matching.length, counts };
}

/** Changes a report's status or note. Returns the updated report, or null if not found. */
export async function updateReport(id: string, changes: { status?: unknown; adminNote?: unknown }): Promise<Report | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const pathname = (await listReportPaths()).find(p => parseReportName(p)?.id === id);
  if (!pathname) return null;
  const report = await readReport(pathname);
  if (!report) return null;
  if (STATUSES.includes(changes.status as ReportStatus)) report.status = changes.status as ReportStatus;
  if (typeof changes.adminNote === 'string') report.adminNote = changes.adminNote.trim().slice(0, 500);
  report.updatedAt = new Date().toISOString();
  // A status change moves the file to that status's folder.
  const target = pathFor(report);
  await put(target, JSON.stringify(report), { access: 'private', contentType: 'application/json', allowOverwrite: true });
  if (target !== pathname) await del(pathname);
  return report;
}
