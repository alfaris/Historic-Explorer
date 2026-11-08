import React, { useMemo } from 'react';
import { Sun, Thermometer } from 'lucide-react';
import { cairoTime, formatTime } from '../lib/opening-hours';
import { cairoDate } from '../lib/special-hours';
import { coolerStart, fetchedMinutes, isStale, walkWeather } from '../lib/weather';
import { useForecast } from '../lib/weather-store';
import { L, LANGUAGES, byLang, currentLang, type Lang } from '../i18n/lang';

const clock = (d: Date, lang: Lang) => formatTime(cairoTime(d).minutes, lang);

/** "forecast from 14:05", with the day when it isn't today's. */
function forecastFrom(fetchedAt: number, now: Date, lang: Lang): string {
  const at = new Date(fetchedAt);
  const sameDay = cairoDate(at) === cairoDate(now);
  const time = sameDay
    ? formatTime(fetchedMinutes({ fetchedAt, hours: [] }), lang)
    : new Intl.DateTimeFormat(LANGUAGES[lang].locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(at);
  return byLang({ en: `forecast from ${time}`, ar: `توقعات ${time}`, fr: `prévisions de ${time}`, es: `previsión de las ${time}` }, lang);
}

/**
 * Heat advice for a walk from `start` lasting `minutes`: the forecast's
 * hottest temperature and UV, and when that's hot, water and shade, the cafés
 * on the route, and a cooler time to start that day (with a button, where the
 * start can be changed). Nothing without a forecast for those hours.
 */
export function WeatherAdvice({ start, minutes, breaks, onStartAt, className = '' }: {
  start: Date;
  minutes: number;
  /** Cafés and places to eat on the route, for a rest out of the sun. */
  breaks: number;
  onStartAt?: (at: Date) => void;
  className?: string;
}) {
  const forecast = useForecast();
  const lang = currentLang();
  const end = useMemo(() => new Date(start.getTime() + minutes * 60_000), [start, minutes]);
  const weather = useMemo(() => (forecast ? walkWeather(forecast, start, end) : null), [forecast, start, end]);
  const cooler = useMemo(() => (forecast && weather?.hot ? coolerStart(forecast, start, minutes) : null), [forecast, weather, start, minutes]);
  if (!forecast || !weather) return null;
  const now = new Date();
  const stale = isStale(forecast, now) ? ` (${forecastFrom(forecast.fetchedAt, now, lang)})` : '';
  const t = weather.maxTemp;
  const uv = weather.maxUv;

  const line = byLang({
    en: `Forecast for the walk: up to ${t} °C · UV ${uv}`,
    ar: `الطقس المتوقع أثناء الجولة: حتى ${t}° · الأشعة فوق البنفسجية ${uv}`,
    fr: `Météo pendant la visite : jusqu’à ${t} °C · UV ${uv}`,
    es: `Previsión para el paseo: hasta ${t} °C · UV ${uv}`,
  }, lang);

  if (!weather.hot) {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-xs text-stone-600 ${className}`}>
        <Thermometer className="w-3.5 h-3.5 shrink-0 text-gold" aria-hidden="true" />
        {line}
        {stale}
      </p>
    );
  }

  return (
    <div className={`rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-start ${className}`}>
      <p className="flex items-center gap-2 font-bold text-amber-900">
        <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
        {L('Hot for walking', 'الجو حار للمشي')}
      </p>
      <p className="mt-1 text-stone-700">
        {line}
        {stale}
      </p>
      <p className="mt-1 text-stone-700">
        {L('Carry water, cover your head and rest in the shade.', 'احمل الماء وغطِّ رأسك واسترح في الظل.')}
        {breaks > 0 && (
          <>
            {' '}
            {byLang({
              en: `Cafés and places to eat on this route: ${breaks}.`,
              ar: `مقاهٍ ومطاعم على هذا المسار: ${breaks}.`,
              fr: `Cafés et restaurants sur ce parcours : ${breaks}.`,
              es: `Cafés y restaurantes en esta ruta: ${breaks}.`,
            }, lang)}
          </>
        )}
      </p>
      {cooler && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-700">
          <span>
            {byLang({
              en: `Cooler if you start at ${clock(cooler.start, lang)} (up to ${cooler.maxTemp} °C).`,
              ar: `أبرد إن بدأت الساعة ${clock(cooler.start, lang)} (حتى ${cooler.maxTemp}°).`,
              fr: `Plus frais en partant à ${clock(cooler.start, lang)} (jusqu’à ${cooler.maxTemp} °C).`,
              es: `Más fresco si empiezas a las ${clock(cooler.start, lang)} (hasta ${cooler.maxTemp} °C).`,
            }, lang)}
          </span>
          {onStartAt && (
            <button
              type="button"
              onClick={() => onStartAt(cooler.start)}
              className="min-h-11 px-3 rounded-xl bg-white border border-amber-300 text-xs font-bold uppercase tracking-widest text-ink hover:border-nile"
            >
              {byLang({
                en: `Start at ${clock(cooler.start, lang)}`,
                ar: `ابدأ الساعة ${clock(cooler.start, lang)}`,
                fr: `Partir à ${clock(cooler.start, lang)}`,
                es: `Empezar a las ${clock(cooler.start, lang)}`,
              }, lang)}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
