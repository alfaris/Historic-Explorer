import { describe, expect, it } from 'vitest';
import { arrowRotation, bearingDegrees, compassPoint, startIndex, approachAlert } from './walk-mode';

describe('bearingDegrees', () => {
  const o = { lat: 30, lng: 31 };
  it.each([
    [{ lat: 30.01, lng: 31 }, 0],
    [{ lat: 30, lng: 31.01 }, 90],
    [{ lat: 29.99, lng: 31 }, 180],
    [{ lat: 30, lng: 30.99 }, 270],
  ])('points the right way to %j', (to, expected) => {
    expect(bearingDegrees(o, to)).toBeCloseTo(expected, 0);
  });

  it('gives Ibn Tulun to Sarghatmish as roughly north-west', () => {
    const b = bearingDegrees({ lat: 30.02871, lng: 31.25024 }, { lat: 30.0294, lng: 31.249 });
    expect(compassPoint(b, false)).toBe('NW');
  });
});

describe('compassPoint', () => {
  it.each([[0, 'N'], [44, 'NE'], [90, 'E'], [181, 'S'], [270, 'W'], [337.6, 'N'], [-45, 'NW']])('%d° is %s', (deg, label) => {
    expect(compassPoint(deg, false)).toBe(label);
  });
  it('speaks Arabic', () => {
    expect(compassPoint(90, true)).toBe('شرقًا');
  });
});

describe('arrowRotation', () => {
  it('points at the bearing with north up when there is no compass', () => {
    expect(arrowRotation(120, null)).toBe(120);
  });
  it('turns with the phone', () => {
    expect(arrowRotation(120, 90)).toBe(30);
    expect(arrowRotation(10, 350)).toBe(20);
  });
});

describe('startIndex', () => {
  it('starts at the first stop not visited yet', () => {
    expect(startIndex([1, 2, 3], new Set([1]))).toBe(1);
    expect(startIndex([1, 2, 3], new Set())).toBe(0);
  });
  it('starts again from the beginning when everything is visited', () => {
    expect(startIndex([1, 2], new Set([1, 2]))).toBe(0);
  });
});

describe('compassPoint in French', () => {
  it('uses O for west', () => {
    expect(compassPoint(270, 'fr')).toBe('O');
    expect(compassPoint(315, 'fr')).toBe('NO');
  });
});

describe('compassPoint in Spanish', () => {
  it('uses O for west, like French', () => {
    expect(compassPoint(270, 'es')).toBe('O');
    expect(compassPoint(315, 'es')).toBe('NO');
    expect(compassPoint(45, 'es')).toBe('NE');
  });
});

describe('approachAlert', () => {
  const next = { id: 7 };
  it('fires inside 60 m, before arrival', () => {
    expect(approachAlert(next, 55, 10, new Set())).toBe(7);
    expect(approachAlert(next, 80, 10, new Set())).toBeNull();
    expect(approachAlert(next, 25, 10, new Set())).toBeNull(); // arrived: arrival takes over
  });
  it('fires once per stop', () => expect(approachAlert(next, 50, 10, new Set([7]))).toBeNull());
  it('needs a fix precise enough to tell', () => expect(approachAlert(next, 50, 120, new Set())).toBeNull());
  it('needs a next stop and a distance', () => {
    expect(approachAlert(null, 50, 10, new Set())).toBeNull();
    expect(approachAlert(next, null, null, new Set())).toBeNull();
  });
});
