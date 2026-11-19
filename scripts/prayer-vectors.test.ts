// The prayer-time vectors the native apps are checked against (contracts/vectors)
// must be what the web computes today, whatever the phone's time zone.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRAYER_VECTORS_PATH, prayerVectors, prayerVectorsText } from './prayer-vectors';

const checkedIn = readFileSync(new URL(`../${PRAYER_VECTORS_PATH}`, import.meta.url), 'utf8');

describe('prayer-time vectors', () => {
  it('are up to date with the web (run npm run gen:vectors)', () => {
    expect(JSON.parse(checkedIn)).toEqual(JSON.parse(prayerVectorsText()));
  });

  it('cover every day of three years, each in order and in that Cairo day', () => {
    const { days } = prayerVectors();
    expect(days).toHaveLength(365 + 365 + 366); // 2026, 2027, 2028 (a leap year)
    for (const [day, ...times] of days) {
      const t = times as number[];
      expect([...t].sort((a, b) => a - b), String(day)).toEqual(t);
      // Fajr to Isha all fall on that calendar day in Cairo (UTC+2, or +3 in summer).
      const cairoDate = (m: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(m * 60_000));
      expect(cairoDate(t[0]), String(day)).toBe(day);
      expect(cairoDate(t[6]), String(day)).toBe(day);
      // Sunset is maghrib (the Egyptian method adds nothing to it); the apps rely on this.
      expect(t[4], String(day)).toBe(t[5]);
    }
  });

  it('come out the same whatever the time zone the web runs in', () => {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Africa/Cairo']) {
      const text = execFileSync('npx', ['tsx', '-e', "import('./scripts/prayer-vectors.ts').then(m => process.stdout.write(m.prayerVectorsText()))"], {
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      });
      expect(text, tz).toBe(checkedIn);
    }
  }, 60_000);
});
