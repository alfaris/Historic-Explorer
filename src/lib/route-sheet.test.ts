import { describe, expect, it } from 'vitest';
import { compactWeek, oneLine, sheetMap } from './route-sheet';

describe('compactWeek', () => {
  it('joins consecutive days with the same hours', () => {
    const rows = ['Mon', 'Tue', 'Wed', 'Thu'].map(name => ({ name, text: '9 am–5 pm' })).concat([{ name: 'Fri', text: 'Closed' }, { name: 'Sat', text: '9 am–5 pm' }, { name: 'Sun', text: '9 am–5 pm' }]);
    expect(compactWeek(rows)).toBe('Mon–Thu 9 am–5 pm · Fri Closed · Sat–Sun 9 am–5 pm');
  });
  it('one group when every day is the same', () => {
    expect(compactWeek(['Mon', 'Tue'].map(name => ({ name, text: 'x' })))).toBe('Mon–Tue x');
  });
});

describe('sheetMap', () => {
  it('keeps the stops inside the box, north up and west to the left', () => {
    const m = sheetMap([{ lat: 30.03, lng: 31.25 }, { lat: 30.02, lng: 31.26 }, { lat: 30.025, lng: 31.255 }]);
    for (const p of m.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(m.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(m.height);
    }
    const [north, south] = m.points;
    expect(north.y).toBeLessThan(south.y);
    expect(north.x).toBeLessThan(south.x);
  });
  it('copes with a single stop', () => {
    const m = sheetMap([{ lat: 30, lng: 31 }]);
    expect(m.points).toHaveLength(1);
    expect(Number.isFinite(m.points[0].x) && Number.isFinite(m.points[0].y)).toBe(true);
  });
});

describe('oneLine', () => {
  it('keeps the first sentence', () => expect(oneLine('A mosque. Built in 879.')).toBe('A mosque.'));
  it('shortens a long sentence at a word', () => {
    const s = oneLine('word '.repeat(60), 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('…')).toBe(true);
  });
  it('handles Arabic punctuation', () => expect(oneLine('جامع قديم؟ نعم')).toBe('جامع قديم؟'));
});
