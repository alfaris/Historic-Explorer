import { describe, expect, it } from 'vitest';
import { parseCanonicalQuery } from './guard';
import { audioCacheControl } from './gemini';
import { audioVersion, textHash } from '../../src/lib/text-hash';

const q = (s: string, allowVersion = false) => parseCanonicalQuery(new URL(`https://x/api?${s}`), { allowVersion });

describe('parseCanonicalQuery', () => {
  it('accepts the plain query', () => expect(q('id=1&lang=en')).toEqual({ id: 1, lang: 'en', version: null }));
  it('accepts French and rejects other languages', () => {
    expect(q('id=1&lang=fr')).toEqual({ id: 1, lang: 'fr', version: null });
    expect(q('id=1&lang=de')).toBeInstanceOf(Response);
  });
  it('accepts a version only where allowed', () => {
    expect(q('id=1&lang=ar&v=0a1b2c3d', true)).toEqual({ id: 1, lang: 'ar', version: '0a1b2c3d' });
    expect(q('id=1&lang=ar&v=0a1b2c3d')).toBeInstanceOf(Response);
  });
  it.each(['id=1&lang=en&v=xyz', 'id=1&lang=en&v=0a1b2c3d&x=1', 'id=1&lang=en&v=1&v=2'])('rejects %s', s => {
    expect(q(s, true)).toBeInstanceOf(Response);
  });
});

describe('audio caching', () => {
  const text = 'The oldest mosque in Cairo in its original form.';
  it('caches long only when the URL version matches the current description', () => {
    expect(audioCacheControl(audioVersion(text), text)).toMatch(/s-maxage=31536000/);
    expect(audioCacheControl(audioVersion(text), `${text} (edited)`)).toBe('no-store');
    expect(audioCacheControl(null, text)).toBe('no-store');
    // The version from before transcripts: those copies may have none.
    expect(audioCacheControl(textHash(text), text)).toBe('no-store');
  });
  it('caches audio without a transcript for an hour only', () => {
    expect(audioCacheControl(audioVersion(text), text, false)).toBe('public, max-age=3600, s-maxage=3600');
  });
  it('gives an edited description a new URL', () => {
    expect(textHash(text)).toMatch(/^[0-9a-f]{8}$/);
    expect(textHash(`${text}.`)).not.toBe(textHash(text));
  });
});
