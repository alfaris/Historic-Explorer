// The versioned content API for the native apps (GET /api/v1/content).
// Installed apps can't be updated as fast as the web, so the response says
// which version of the content model it is, and which app build it needs.
// It also carries each place's audio guide URLs, built here with the same
// recipe as the web: an app must never compute the hash itself, since a wrong
// one misses the CDN cache and makes the server generate the guide again.

import { createHash } from 'node:crypto';
import type { Content } from '../../src/data/content.js';
import { glossaryOf } from '../../src/data/glossary-of.js';
import { descriptionOf, LANGS, type Lang } from '../../src/i18n/lang.js';
import { narrationSource } from '../../src/lib/guide-kind.js';
import { audioVersion } from '../../src/lib/text-hash.js';

/** Raised when the shape of the served content changes (additions only, while it is 1). */
export const SCHEMA_VERSION = 1;
/**
 * The oldest app build that can read this content: Android's versionCode (iOS build
 * numbers must be plain integers too; give iOS its own field if the counters part).
 * Raise on purpose.
 */
export const MIN_APP_VERSION = 1;

export type AudioUrls = Partial<Record<Lang, string>>;

export interface ContentV1 {
  /** @asType integer */
  schemaVersion: number;
  /** A hash of everything in the response: changes whenever the content, the audio URLs or the versions change. */
  contentVersion: string;
  /** @asType integer */
  minAppVersion: number;
  /**
   * The content as visitors get it, with what the server fills in already applied:
   * the glossary is the built-in one until the admin saves one, so an app never
   * needs its own copy.
   */
  content: Content;
  /**
   * By place ID (the ID as a string, as JSON keys are): the audio guide URL in each language that has a description to
   * narrate (a missing language has no guide). The URLs are relative to the API's
   * origin. Use them as they are; never rebuild them.
   */
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

const sized = (photo: { width: number; height: number } | undefined) =>
  !!photo && Number.isInteger(photo.width) && Number.isInteger(photo.height) && photo.width >= 1 && photo.height >= 1;

/**
 * Leaves out photos whose size isn't whole pixels. validateContent refuses them,
 * but a restored old version could still hold one, and the apps decode sizes as
 * integers (one bad size would fail the whole response).
 */
function withSizedPhotos(content: Content): Content {
  const routes = content.routes.map(r => (r.photo && !sized(r.photo) ? (({ photo: _bad, ...rest }) => rest)(r) : r));
  const places = content.places.map(p => {
    let place = p;
    if (place.photo && !sized(place.photo)) place = (({ photo: _bad, ...rest }) => rest)(place);
    if (place.gallery?.some(g => !sized(g))) {
      const gallery = place.gallery.filter(sized);
      place = gallery.length ? { ...place, gallery } : (({ gallery: _none, ...rest }) => rest)(place);
    }
    return place;
  });
  return { ...content, routes, places };
}

export function contentV1(stored: Content, audioFor: (place: Content['places'][number]) => AudioUrls = audioUrlsFor): ContentV1 {
  // What the web falls back to on its own (glossaryOf), sent filled in.
  const content: Content = withSizedPhotos({ ...stored, glossary: glossaryOf(stored) });
  const audio: Record<string, AudioUrls> = {};
  for (const place of content.places) audio[place.id] = audioFor(place);
  // The version covers everything an app keeps, not only the content: audio URLs
  // change on their own when the audio recipe does (a new audioVersion prefix,
  // a change to how places are narrated), and an app that skipped them would keep
  // requesting stale URLs.
  const contentVersion = sha256(JSON.stringify({ schemaVersion: SCHEMA_VERSION, minAppVersion: MIN_APP_VERSION, content, audio })).slice(0, 16);
  return { schemaVersion: SCHEMA_VERSION, contentVersion, minAppVersion: MIN_APP_VERSION, content, audio };
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
