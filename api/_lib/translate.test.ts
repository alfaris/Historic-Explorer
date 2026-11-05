import { describe, expect, it } from 'vitest';
import { parseTranslateRequest, pickTranslations } from './translate';

describe('parseTranslateRequest', () => {
  it('keeps non-empty trimmed texts', () => {
    expect(parseTranslateRequest({ texts: { 'p1.name': ' Al-Azhar ', 'p1.desc': '  ' } })).toEqual({ texts: { 'p1.name': 'Al-Azhar' } });
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
