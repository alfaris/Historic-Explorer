// Heat advice for a walk: the hourly forecast for Cairo (Open-Meteo, free, no
// key), how hot and sunny the planned walk will be, and the coolest time to
// start that day. Pure; the fetching and caching are in weather-store.ts.

import { cairoTime } from './opening-hours';
import { cairoInstant } from './visit-plan';

/** Cairo's hourly temperature and UV index for the next 7 days, times as Unix seconds. */
export const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=30.045&longitude=31.26&hourly=temperature_2m,uv_index&timeformat=unixtime&timezone=Africa%2FCairo&forecast_days=7';

/** Hot for walking: at or above this temperature (°C)… */
export const HOT_TEMP = 33;
/** …or this UV index (very high). */
export const HIGH_UV = 8;
/** A forecast older than this is shown with its time ("forecast from …"). */
export const STALE_MS = 3 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;

export interface ForecastHour {
  /** Start of the hour, epoch milliseconds. */
  t: number;
  temp: number;
  uv: number;
}
export interface Forecast {
  fetchedAt: number;
  hours: ForecastHour[];
}

/** Open-Meteo's reply as a forecast; null if it isn't one. */
export function parseForecast(json: unknown, fetchedAt: number): Forecast | null {
  const h = (json as { hourly?: { time?: unknown; temperature_2m?: unknown; uv_index?: unknown } } | null)?.hourly;
  if (!h || !Array.isArray(h.time) || !Array.isArray(h.temperature_2m) || !Array.isArray(h.uv_index)) return null;
  const temps = h.temperature_2m as unknown[];
  const uvs = h.uv_index as unknown[];
  const hours: ForecastHour[] = [];
  (h.time as unknown[]).forEach((t, i) => {
    const temp = temps[i];
    const uv = uvs[i];
    if (typeof t === 'number' && typeof temp === 'number' && Number.isFinite(temp)) {
      hours.push({ t: t * 1000, temp, uv: typeof uv === 'number' && Number.isFinite(uv) ? uv : 0 });
    }
  });
  return hours.length ? { fetchedAt, hours } : null;
}

export const isHot = (temp: number, uv: number) => temp >= HOT_TEMP || uv >= HIGH_UV;

export interface WalkWeather {
  maxTemp: number;
  maxUv: number;
  hot: boolean;
}

/** The hottest and sunniest the walk will be, from `start` to `end`; null when the forecast doesn't cover it. */
export function walkWeather(f: Forecast, start: Date, end: Date): WalkWeather | null {
  const from = Math.floor(start.getTime() / HOUR) * HOUR;
  const to = Math.max(end.getTime(), start.getTime());
  const hours = f.hours.filter(h => h.t >= from && h.t <= to);
  // Every hour of the walk should be in the forecast, or the advice could miss the hot part.
  const needed = Math.floor((to - from) / HOUR) + 1;
  if (hours.length < needed) return null;
  const maxTemp = Math.max(...hours.map(h => h.temp));
  const maxUv = Math.max(...hours.map(h => h.uv));
  return { maxTemp: Math.round(maxTemp), maxUv: Math.round(maxUv), hot: isHot(maxTemp, maxUv) };
}

/** The earliest and latest start the coolest-start search tries (Cairo time, minutes after midnight). */
const SEARCH_FROM = 7 * 60;
const SEARCH_TO = 17 * 60;

export interface CoolerStart extends WalkWeather {
  start: Date;
}

/**
 * A cooler time to start a walk of `minutes` on the same Cairo day as
 * `start`, trying each hour from 7:00 to 17:00: the one with the lowest
 * peak temperature, then UV. Only offered when it's no longer hot, or at
 * least 2 °C cooler than starting at `start`.
 */
export function coolerStart(f: Forecast, start: Date, minutes: number): CoolerStart | null {
  const current = walkWeather(f, start, new Date(start.getTime() + minutes * 60_000));
  if (!current?.hot) return null;
  let best: CoolerStart | null = null;
  for (let m = SEARCH_FROM; m <= SEARCH_TO; m += 60) {
    const at = cairoInstant(start, 0, m);
    const w = walkWeather(f, at, new Date(at.getTime() + minutes * 60_000));
    if (!w) continue;
    if (!best || w.maxTemp < best.maxTemp || (w.maxTemp === best.maxTemp && w.maxUv < best.maxUv)) best = { ...w, start: at };
  }
  if (!best || Math.abs(best.start.getTime() - start.getTime()) < 30 * 60_000) return null;
  return !best.hot || best.maxTemp <= current.maxTemp - 2 ? best : null;
}

/** Whether a forecast should be shown with its time, being a few hours old (offline). */
export const isStale = (f: Forecast, now: Date) => now.getTime() - f.fetchedAt > STALE_MS;

/** The forecast's own time in Cairo, minutes after midnight (for "forecast from 14:05"). */
export const fetchedMinutes = (f: Forecast) => cairoTime(new Date(f.fetchedAt)).minutes;

/** Cafés and places to eat on a route: somewhere to rest out of the sun. */
export const breakCount = (places: { routeId: string; category: string }[], routeId: string) =>
  places.filter(p => p.routeId === routeId && (p.category === 'coffee' || p.category === 'restaurant')).length;
