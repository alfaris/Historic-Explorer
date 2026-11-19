// The versioned content API for the native apps (GET /api/v1/content).
// Installed apps can't be updated as fast as the web, so the response says
// which version of the content model it is, and which app build it needs.
// It also carries each place's audio guide URLs, built here with the same
// recipe as the web: an app must never compute the hash itself, since a wrong
// one misses the CDN cache and makes the server generate the guide again.

import { createHash } from 'node:crypto';
import type { Content } from '../../src/data/content.js';
import { descriptionOf, LANGS, type Lang } from '../../src/i18n/lang.js';
import { narrationSource } from '../../src/lib/guide-kind.js';
import { audioVersion } from '../../src/lib/text-hash.js';

/** Raised when the shape of the served content changes (additions only, while it is 1). */
export const SCHEMA_VERSION = 1;
/** The oldest app build (versionCode / CFBundleVersion) that can read this content. Raise on purpose. */
export const MIN_APP_VERSION = 1;

export type AudioUrls = Partial<Record<Lang, string>>;

export interface ContentV1 {
  schemaVersion: number;
  /** A hash of the content: changes whenever anything visitors see changes. */
  contentVersion: string;
  minAppVersion: number;
  content: Content;
  /** By place ID: the audio guide URL in each language that has a description to narrate. */
  audio: Record<string, AudioUrls>;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The audio guide URL for a place in a language, exactly as the web builds it (see audioGuideUrl). */
export function audioUrlsFor(place: Content['places'][number]): AudioUrls {
  const urls: AudioUrls = {};
  for (const lang of LANGS) {
    const text = descriptionOf(place, lang);
    if (text) urls[lang] = `/api/audio-guide?id=${place.id}&lang=${lang}&v=${audioVersion(narrationSource(place, lang, text))}`;
  }
  return urls;
}

export function contentV1(content: Content): ContentV1 {
  const audio: Record<string, AudioUrls> = {};
  for (const place of content.places) audio[place.id] = audioUrlsFor(place);
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: sha256(JSON.stringify(content)).slice(0, 16),
    minAppVersion: MIN_APP_VERSION,
    content,
    audio,
  };
}

/** The serialized response and its strong ETag (a hash of exactly those bytes). */
export function serializeV1(content: Content): { body: string; etag: string } {
  const body = JSON.stringify(contentV1(content));
  return { body, etag: `"${sha256(body).slice(0, 32)}"` };
}

/** Whether an If-None-Match header names this ETag (a list, or *). Weak validators match too. */
export const etagMatches = (header: string | null, etag: string) =>
  !!header && header.split(',').some(tag => {
    const t = tag.trim();
    return t === '*' || t === etag || t === `W/${etag}`;
  });
