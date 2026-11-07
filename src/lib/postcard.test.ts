import { describe, expect, it } from 'vitest';
import { coverCrop, photoCredit, wrapLines } from './postcard';

const measure = (s: string) => s.length * 10; // 10 px a character

describe('wrapLines', () => {
  it('keeps short text on one line', () => expect(wrapLines('Walk complete', 200, measure)).toEqual(['Walk complete']));
  it('breaks at words', () => expect(wrapLines('Al-Darb Al-Ahmar and the Citadel', 170, measure)).toEqual(['Al-Darb Al-Ahmar', 'and the Citadel']));
  it('cuts the last line with an ellipsis', () => {
    const lines = wrapLines('one two three four five six seven eight', 100, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(100);
  });
  it('keeps a single long word whole rather than lose it', () => expect(wrapLines('Supercalifragilistic', 50, measure)).toEqual(['Supercalifragilistic']));
});

describe('coverCrop', () => {
  it('crops the sides of a wide photo, centred', () => {
    expect(coverCrop(2000, 1000, 1000, 1000)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });
  it('crops top and bottom of a tall photo', () => {
    const c = coverCrop(1000, 2000, 1000, 500);
    expect(c).toEqual({ sx: 0, sy: 750, sw: 1000, sh: 500 });
  });
});

describe('photoCredit', () => {
  it('names the author, the license and where to read it', () => {
    expect(photoCredit({ author: 'Sailko', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0' }, 'Photo')).toBe('Photo: Sailko · CC BY 3.0 · creativecommons.org/licenses/by/3.0');
    expect(photoCredit({ author: 'Admin upload', license: 'Own work', licenseUrl: null }, 'Photo')).toBe('Photo: Admin upload · Own work');
  });
});
