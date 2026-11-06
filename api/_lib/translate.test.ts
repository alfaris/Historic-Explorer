import { describe, expect, it } from 'vitest';
import { parseTranslateRequest, pickTranslations, translatePrompt } from './translate';

describe('parseTranslateRequest', () => {
  it('keeps non-empty trimmed texts', () => {
    expect(parseTranslateRequest({ texts: { 'p1.name': ' Al-Azhar ', 'p1.desc': '  ' } })).toEqual({ lang: 'fr', texts: { 'p1.name': 'Al-Azhar' } });
  });
  it('rejects bad shapes, keys and sizes', () => {
    expect(parseTranslateRequest(null)).toHaveProperty('error');
    expect(parseTranslateRequest({ texts: ['a'] })).toHaveProperty('error');
    expect(parseTranslateRequest({ texts: { 'bad key!': 'x' } })).toHaveProperty('error');
    expect(parseTranslateRequest({ texts: { a: 5 } })).toHaveProperty('error');
    expect(parseTranslateRequest({ texts: { a: 'x'.repeat(2001) } })).toHaveProperty('error');
    expect(parseTranslateRequest({ texts: {} })).toHaveProperty('error');
    const many = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`k${i}`, 'x']));
    expect(parseTranslateRequest({ texts: many })).toHaveProperty('error');
  });
});

describe('pickTranslations', () => {
  it('keeps only requested keys with string values', () => {
    expect(pickTranslations({ a: 'x', b: 'y' }, { a: ' Bonjour ', b: 3, c: 'extra' })).toEqual({ a: 'Bonjour' });
    expect(pickTranslations({ a: 'x' }, 'nope')).toEqual({});
  });
});

describe('target language', () => {
  it('takes French or Spanish, defaulting to French', () => {
    expect(parseTranslateRequest({ lang: 'es', texts: { a: 'Hi' } })).toEqual({ lang: 'es', texts: { a: 'Hi' } });
    expect(parseTranslateRequest({ lang: 'ar', texts: { a: 'Hi' } })).toEqual({ error: 'lang must be fr or es.' });
    expect(parseTranslateRequest({ lang: 'de', texts: { a: 'Hi' } })).toHaveProperty('error');
  });
  it('asks for that language', () => {
    expect(translatePrompt('es')).toMatch(/into Spanish/);
    expect(translatePrompt('es')).toMatch(/El Cairo/);
    expect(translatePrompt('fr')).toMatch(/into French/);
  });
});
