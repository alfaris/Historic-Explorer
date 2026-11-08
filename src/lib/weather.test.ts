import { describe, expect, it } from 'vitest';
import { cairoInstant } from './visit-plan';
import { cairoTime } from './opening-hours';
import { coolerStart, isHot, isStale, parseForecast, walkWeather, type Forecast } from './weather';

// A July day in Cairo: 26 °C at dawn, 38 °C at 14:00, UV 10 at midday.
const day = new Date('2026-07-15T09:00:00Z');
const tempAt = (h: number) => Math.round(26 + 12 * Math.max(0, Math.sin(((h - 6) / 16) * Math.PI)) * (h >= 6 && h <= 22 ? 1 : 0));
const uvAt = (h: number) => (h >= 7 && h <= 17 ? Math.max(0, 10 - Math.abs(12 - h) * 2) : 0);
const hours = Array.from({ length: 48 }, (_, i) => {
  const at = cairoInstant(day, 0, i * 60);
  const h = i % 24;
  return { t: Math.floor(at.getTime() / 1000), temp: tempAt(h), uv: uvAt(h) };
});
const json = { hourly: { time: hours.map(h => h.t), temperature_2m: hours.map(h => h.temp), uv_index: hours.map(h => h.uv) } };
const forecast = parseForecast(json, day.getTime())!;
const at = (hh: number, mm = 0) => cairoInstant(day, 0, hh * 60 + mm);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);

describe('parseForecast', () => {
  it("reads Open-Meteo's hourly arrays", () => {
    expect(forecast.hours).toHaveLength(48);
    expect(forecast.hours[14]).toMatchObject({ temp: tempAt(14), uv: uvAt(14) });
    expect(forecast.hours[1].t - forecast.hours[0].t).toBe(3_600_000);
  });
  it('refuses anything else, and skips missing temperatures', () => {
    expect(parseForecast({ error: true }, 0)).toBeNull();
    expect(parseForecast(null, 0)).toBeNull();
    const partial = parseForecast({ hourly: { time: [1, 2], temperature_2m: [null, 30], uv_index: [null, null] } }, 0)!;
    expect(partial.hours).toEqual([{ t: 2000, temp: 30, uv: 0 }]);
  });
});

describe('walkWeather', () => {
  it('takes the hottest and sunniest hour of the walk', () => {
    const w = walkWeather(forecast, at(13), at(15, 30))!;
    expect(w.maxTemp).toBe(Math.max(tempAt(13), tempAt(14), tempAt(15)));
    expect(w.maxUv).toBe(uvAt(13));
    expect(w.hot).toBe(true);
    expect(walkWeather(forecast, at(6), at(7, 30))!.hot).toBe(false);
  });
  it('says nothing when the forecast does not cover the whole walk', () => {
    expect(walkWeather(forecast, cairoInstant(day, 3, 9 * 60), cairoInstant(day, 3, 11 * 60))).toBeNull();
    expect(walkWeather(forecast, cairoInstant(day, 1, 22 * 60), cairoInstant(day, 2, 1 * 60))).toBeNull();
  });
  it('knows hot', () => {
    expect(isHot(33, 2)).toBe(true);
    expect(isHot(30, 8)).toBe(true);
    expect(isHot(32.9, 7.9)).toBe(false);
  });
});

describe('coolerStart', () => {
  it('suggests an early start on a hot afternoon', () => {
    const s = coolerStart(forecast, at(13), 150)!;
    expect(cairoTime(s.start).minutes).toBe(7 * 60);
    expect(s.maxTemp).toBeLessThan(walkWeather(forecast, at(13), plus(at(13), 150))!.maxTemp - 2);
  });
  it('suggests nothing when the walk is not hot, or already at the coolest time', () => {
    expect(coolerStart(forecast, at(6), 60)).toBeNull();
    expect(coolerStart(forecast, at(7), 150)).toBeNull();
  });
  it('suggests nothing without a forecast for that day', () => {
    expect(coolerStart(forecast, cairoInstant(day, 4, 13 * 60), 120)).toBeNull();
  });
});

describe('isStale', () => {
  it('is stale after three hours', () => {
    const f: Forecast = { fetchedAt: day.getTime(), hours: [] };
    expect(isStale(f, plus(day, 179))).toBe(false);
    expect(isStale(f, plus(day, 181))).toBe(true);
  });
});
