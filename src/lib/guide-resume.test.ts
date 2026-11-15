import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_ENTRIES, clockLabel, parsePoints, resumePoint, withPosition, type ResumePoint } from './guide-resume';

describe('withPosition', () => {
  it('remembers a guide stopped part way, as the newest', () => {
    const old: ResumePoint[] = [{ key: 'b', at: 30, saved: 1 }];
    const next = withPosition(old, 'a', 102.7, 240, 5);
    expect(next).toEqual([{ key: 'a', at: 102, saved: 5, length: 240 }, { key: 'b', at: 30, saved: 1 }]);
    expect(resumePoint(next, 'a')).toBe(102);
  });

  it('updates the same guide instead of adding it twice', () => {
    const next = withPosition([{ key: 'a', at: 30, saved: 1 }], 'a', 60, 240, 2);
    expect(next).toEqual([{ key: 'a', at: 60, saved: 2, length: 240 }]);
  });

  it('forgets a guide stopped in its first seconds or listened to the end', () => {
    const points: ResumePoint[] = [{ key: 'a', at: 30, saved: 1 }];
    expect(withPosition(points, 'a', 3, 240, 2)).toEqual([]);
    expect(withPosition(points, 'a', 238, 240, 2)).toEqual([]);
    expect(withPosition(points, 'a', 240, 240, 2)).toEqual([]);
  });

  it('keeps the position when the length is unknown', () => {
    expect(withPosition([], 'a', 50, NaN, 1)).toEqual([{ key: 'a', at: 50, saved: 1 }]);
  });

  it(`keeps only the ${MAX_ENTRIES} most recent`, () => {
    let points: ResumePoint[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) points = withPosition(points, `k${i}`, 20, 100, i);
    expect(points).toHaveLength(MAX_ENTRIES);
    expect(resumePoint(points, 'k0')).toBeNull();
    expect(points[0].key).toBe(`k${MAX_ENTRIES + 4}`);
  });
});

describe('parsePoints', () => {
  it('ignores anything malformed', () => {
    expect(parsePoints(null)).toEqual([]);
    expect(parsePoints('nope')).toEqual([]);
    expect(parsePoints('{"key":"a"}')).toEqual([]);
    expect(parsePoints('[{"key":"a","at":40,"saved":1},{"key":"c","at":40,"saved":1,"length":-3},{"key":"","at":4,"saved":1},{"key":"b","at":"x","saved":1},null]'))
      .toEqual([{ key: 'a', at: 40, saved: 1 }]);
  });
});

describe('clockLabel', () => {
  it('writes minutes and seconds', () => {
    expect(clockLabel(102)).toBe('1:42');
    expect(clockLabel(7)).toBe('0:07');
    expect(clockLabel(3725)).toBe('1:02:05');
  });
});

describe('resume store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  const stub = (data: Map<string, string>, fail: { writes: boolean }) =>
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (fail.writes) throw new Error('QuotaExceeded');
          data.set(k, v);
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });

  it("builds on another tab's points and forgets a guide heard to the end", async () => {
    const data = new Map<string, string>();
    stub(data, { writes: false });
    const { savePosition, RESUME_KEY } = await import('./guide-resume');
    savePosition('a', 40, 200);
    data.set(RESUME_KEY, JSON.stringify([...JSON.parse(data.get(RESUME_KEY)!), { key: 'b', at: 20, saved: 1 }]));
    savePosition('c', 60, 200);
    savePosition('a', 200, 200);
    expect(JSON.parse(data.get(RESUME_KEY)!).map((p: ResumePoint) => `${p.key}@${p.at}`).sort()).toEqual(['b@20', 'c@60']);
  });

  it('keeps unsaved positions and writes them once storage works again', async () => {
    const data = new Map<string, string>();
    const fail = { writes: true };
    stub(data, fail);
    const { savePosition, pointsNow, RESUME_KEY } = await import('./guide-resume');
    savePosition('a', 40, 200);
    savePosition('b', 50, 200);
    expect(pointsNow().map(p => p.key).sort()).toEqual(['a', 'b']);
    fail.writes = false;
    savePosition('c', 60, 200);
    expect(JSON.parse(data.get(RESUME_KEY)!).map((p: ResumePoint) => p.key).sort()).toEqual(['a', 'b', 'c']);
  });
});
