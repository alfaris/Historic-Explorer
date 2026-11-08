// The Cairo forecast for heat advice, fetched from Open-Meteo at most once an
// hour and kept on the device, so the last one still shows offline (with its
// time). Nothing about the visitor is sent: the request is the same for everyone.

import { useEffect, useState } from 'react';
import { FORECAST_URL, parseForecast, type Forecast } from './weather';

export const FORECAST_KEY = 'cw:forecast';
const REFRESH_MS = 60 * 60 * 1000;

export function readCachedForecast(): Forecast | null {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(FORECAST_KEY) ?? 'null');
    if (!raw || typeof raw.fetchedAt !== 'number' || !Array.isArray(raw.hours)) return null;
    const hours = raw.hours.filter((h: unknown) => {
      const x = h as { t?: unknown; temp?: unknown; uv?: unknown };
      return typeof x?.t === 'number' && typeof x.temp === 'number' && typeof x.uv === 'number';
    });
    return hours.length ? { fetchedAt: raw.fetchedAt, hours } : null;
  } catch {
    return null;
  }
}

const save = (f: Forecast) => {
  try {
    globalThis.localStorage?.setItem(FORECAST_KEY, JSON.stringify(f));
  } catch {
    // Not kept; it's fetched again next time.
  }
};

let pending: Promise<Forecast | null> | null = null;

/** The forecast: the kept one while it's under an hour old, else a fresh one (the kept one if that fails). */
export function loadForecast(now = Date.now()): Promise<Forecast | null> {
  const cached = readCachedForecast();
  if (cached && now - cached.fetchedAt < REFRESH_MS) return Promise.resolve(cached);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(cached);
  pending ??= fetch(FORECAST_URL)
    .then(res => (res.ok ? res.json() : null))
    .then(json => {
      const fresh = json && parseForecast(json, Date.now());
      if (fresh) save(fresh);
      return fresh ?? cached;
    })
    .catch(() => cached)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** The forecast for heat advice: the kept one straight away, then a fresh one when it's due. */
export function useForecast(): Forecast | null {
  const [forecast, setForecast] = useState(readCachedForecast);
  useEffect(() => {
    let active = true;
    loadForecast().then(f => {
      if (active && f) setForecast(f);
    });
    return () => {
      active = false;
    };
  }, []);
  return forecast;
}
