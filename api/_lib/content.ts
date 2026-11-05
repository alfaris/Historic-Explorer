// The live content (routes and places), stored as one JSON document in
// Vercel Blob. Until an admin first saves, or when Blob is unavailable, the
// bundled content from src/data/locations.ts is used.

import { BlobNotFoundError, BlobPreconditionFailedError, get, list, put } from '@vercel/blob';
import { bundledContent, normalizeContent, validateContent, withMaxPlaceId, type Content } from '../../src/data/content.js';
import { hasBlobStore } from './http.js';

const CURRENT = 'content/current.json';
const HISTORY_PREFIX = 'content/history/';
const MEMORY_TTL_MS = 30_000;

let memory: { content: Content; at: number } | null = null;

async function readBlobJson(pathname: string): Promise<{ data: unknown; etag: string } | null> {
  try {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return { data: JSON.parse(text), etag: result.blob.etag };
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

/**
 * The current content plus its ETag, read fresh from Blob. etag is null when
 * nothing has been saved yet (the bundled content is in use).
 */
export async function getContentWithEtag(): Promise<{ content: Content; etag: string | null }> {
  if (!hasBlobStore()) return { content: bundledContent, etag: null };
  const stored = await readBlobJson(CURRENT);
  if (!stored) return { content: bundledContent, etag: null };
  const content = normalizeContent(stored.data);
  // Never serve something broken: fall back to the bundled data and log it.
  if (validateContent(content).length) {
    console.error('Stored content is invalid; serving bundled content instead.');
    return { content: bundledContent, etag: stored.etag };
  }
  memory = { content, at: Date.now() };
  return { content, etag: stored.etag };
}

/** The current content, cached briefly in memory on warm instances. */
export async function getContent(): Promise<Content> {
  if (memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.content;
  try {
    return (await getContentWithEtag()).content;
  } catch (err) {
    console.error('Reading content from Blob failed; using bundled content:', err);
    return memory?.content ?? bundledContent;
  }
}

export class ContentConflictError extends Error {
  constructor() {
    super('The content was changed by someone else since you loaded it. Reload and try again.');
  }
}

/**
 * Saves new content if it's valid and nobody else saved in the meantime
 * (expectedEtag must match the stored copy; null means "nothing saved yet").
 * Keeps the new version in the history too. Returns the new ETag.
 */
const writeHistory = (body: string, at: Date) =>
  put(`${HISTORY_PREFIX}${at.toISOString().replace(/[:.]/g, '-')}.json`, body, { access: 'private', contentType: 'application/json' }).catch(err =>
    console.warn('Saving a history copy failed:', err),
  );

export async function saveContent(next: Content, expectedEtag: string | null, note: string): Promise<{ etag: string }> {
  if (!hasBlobStore()) throw new Error('No Blob store is connected, so content can’t be saved.');
  // Carry the highest-ever place ID forward so deleted IDs are never reused,
  // whatever the browser sent.
  const previous = expectedEtag ? (await getContentWithEtag()).content : bundledContent;
  next = withMaxPlaceId(next, previous);
  const now = new Date();
  // Before the very first save, keep the built-in content in the history so
  // the first edit (even a deletion) can be undone.
  if (!expectedEtag && (await listHistory(1)).length === 0) {
    await writeHistory(JSON.stringify({ ...withMaxPlaceId(bundledContent), savedAt: new Date(now.getTime() - 1).toISOString(), note: 'Built-in content' }), new Date(now.getTime() - 1));
  }
  const body = JSON.stringify({ ...next, savedAt: now.toISOString(), note: note.slice(0, 200) });
  let result;
  try {
    result = await put(CURRENT, body, {
      access: 'private',
      contentType: 'application/json',
      ...(expectedEtag ? { ifMatch: expectedEtag } : { allowOverwrite: false }),
    });
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) throw new ContentConflictError();
    // Without an ETag the write fails if a copy already exists.
    if (!expectedEtag && /already exists/i.test(String((err as Error).message))) throw new ContentConflictError();
    throw err;
  }
  memory = { content: next, at: Date.now() };
  await writeHistory(body, now);
  return { etag: result.etag };
}

export interface HistoryEntry {
  pathname: string;
  savedAt: string;
  size: number;
}

/** The most recent saved versions, newest first. */
export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  if (!hasBlobStore()) return [];
  const entries: HistoryEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: HISTORY_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) entries.push({ pathname: b.pathname, savedAt: b.uploadedAt.toISOString(), size: b.size });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, limit);
}

/** A saved version from the history, or null if it doesn't exist. */
export async function readHistory(pathname: string): Promise<(Content & { note?: string }) | null> {
  if (!pathname.startsWith(HISTORY_PREFIX) || pathname.includes('..')) return null;
  const stored = await readBlobJson(pathname);
  if (!stored) return null;
  const data = stored.data as { note?: unknown };
  return { ...normalizeContent(stored.data), note: typeof data.note === 'string' ? data.note : undefined };
}

/** Used by tests to reset the in-memory cache. */
export const _resetContentCache = () => {
  memory = null;
};
