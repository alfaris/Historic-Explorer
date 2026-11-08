import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Location, Route } from '../data/locations';
import { weekRows } from '../lib/opening-hours';
import { useContent } from '../data/ContentContext';
import { addDays, cairoDate, effectiveHours, periodName } from '../lib/special-hours';
import { formatDistance, formatDuration } from '../lib/route-format';
import { compactWeek, oneLine, sheetMap } from '../lib/route-sheet';
import { routeShareUrl } from '../lib/share';
import { walkPlan, walkStops } from '../lib/walk';
import { L, LANGUAGES, currentLang, descriptionOf, fallbackLang, nameOf } from '../i18n/lang';
import { minutesLabel } from './WalkInfo';
import { accessSummary, hasAccessInfo, routeAccess } from '../lib/step-free';
import { accessText } from '../lib/visitor-tips';
import { gettingThere } from '../lib/getting-there';

/**
 * The printable route sheet (A4): the route, a schematic map of the stops,
 * each stop with its walk from the one before, its hours and one line about
 * it, and a QR code that opens the route in the app. Rendered off screen for
 * the browser's print dialog only (see #print-sheet in index.css), then removed.
 */
export default function RouteSheet({ route, places, onDone }: { route: Route; places: Location[]; onDone: () => void }) {
  const lang = currentLang();
  const ar = lang === 'ar';
  const stops = useMemo(() => walkStops(places, route.id), [places, route.id]);
  const plan = useMemo(() => walkPlan(places, route.id), [places, route.id]);
  const map = useMemo(() => sheetMap(stops), [stops]);
  const url = routeShareUrl(window.location.origin, route.id);
  // Hours as they stand for the coming week, special hours (Ramadan, closures) included, as on screen.
  const { specialPeriods } = useContent();
  const now = useMemo(() => new Date(), []);
  const hoursLine = (stop: Location): string | null => {
    const eff = effectiveHours(stop, now, specialPeriods);
    const today = cairoDate(now);
    const last = addDays(today, 6);
    // The periods that change this stop's hours in the week shown.
    const names = (specialPeriods ?? [])
      .filter(p => p.places[String(stop.id)] && p.from <= last && p.to >= today)
      .map(p => periodName(p, lang).text);
    const week = eff.hours ? compactWeek(weekRows(eff.hours, lang)) : eff.closedToday ? L('Closed today', 'مغلق اليوم') : null;
    if (!week) return null;
    const parts = [week];
    if (names.length) parts.push(`${L('Special hours', 'مواعيد خاصة')}: ${names.join(', ')}`);
    else if (eff.mayDiffer) parts.push(`${L('Hours may differ', 'قد تختلف المواعيد')}: ${periodName(eff.mayDiffer, lang).text}`);
    return parts.join(' · ');
  };
  const [qr, setQr] = useState<string | null>(null);

  // The QR code library loads only for printing.
  useEffect(() => {
    let active = true;
    import('qrcode')
      .then(QRCode => QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#1a1a1a', light: '#ffffff' } }))
      .then(svg => active && setQr(svg), () => active && setQr(''));
    return () => {
      active = false;
    };
  }, [url]);

  // Print once the QR code is in (or failed), then tidy up. Once only: the
  // page re-renders while the dialog is up, with a new onDone each time.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (qr === null) return;
    const done = () => doneRef.current();
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [qr]);

  const meta = [formatDistance(route.distanceKm, lang), formatDuration(route.hoursMin, route.hoursMax, lang)].filter(Boolean).join(' · ');
  const access = routeAccess(places, route.id);
  const showAccess = hasAccessInfo(access);
  const there = gettingThere(route, places, lang);
  // "Start: Bab Zuweila (باب زويلة) · Nearest metro: Attaba · Ask for …": the Arabic name to show a driver.
  const startLine = there && [
    `${L('Start', 'البداية')}: ${nameOf(there.start)}${ar ? '' : ` (${there.start.nameAr})`}`,
    there.metro && `${L('Nearest metro', 'أقرب محطة مترو')}: ${there.metro.text}${there.minutes ? ` · ${minutesLabel(there.minutes)}` : ''}`,
    there.note?.text,
  ].filter(Boolean).join(' · ');

  return createPortal(
    <div id="print-sheet" dir={LANGUAGES[lang].dir} lang={lang} className="text-ink bg-white">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink">Cairo Walks</p>
        <h1 className={`text-3xl leading-tight ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{nameOf(route)}</h1>
        {meta && <p className="text-sm text-stone-600">{meta}</p>}
        {showAccess && <p className="text-sm text-stone-600">{accessSummary(access)}</p>}
        {startLine && <p className="text-sm text-stone-600">{startLine}</p>}
        {descriptionOf(route) && <p className="mt-1 text-sm text-stone-700" lang={fallbackLang(route, 'description')}>{descriptionOf(route)}</p>}
      </header>

      {stops.length > 0 && (
        <svg viewBox={`0 0 ${map.width} ${map.height}`} style={{ direction: 'ltr' }} className="w-full border border-stone-300 rounded-lg mb-4" role="img" aria-label={L('Map of the stops', 'خريطة المحطات')}>
          <polyline points={map.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#c49a6c" strokeWidth="3" strokeDasharray="6 6" />
          {map.points.map((p, i) => (
            <g key={stops[i].id}>
              <circle cx={p.x} cy={p.y} r="11" fill="#1a4d3b" stroke="#fff" strokeWidth="2" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">{i + 1}</text>
            </g>
          ))}
          <text x={map.width - 10} y={20} textAnchor="end" fontSize="12" fontWeight="700" fill="#57534e" fontFamily="sans-serif">N ↑</text>
        </svg>
      )}

      <ol className="space-y-2.5">
        {stops.map((stop, i) => {
          const walk = i > 0 ? plan.get(stops[i - 1].id)?.leg?.minutes : undefined;
          const description = descriptionOf(stop);
          return (
            <li key={stop.id} className="flex gap-3 sheet-stop">
              <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-nile text-white text-xs font-bold flex items-center justify-center print-color">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-bold text-sm">
                  {nameOf(stop)}
                  {walk !== undefined && <span className="font-normal text-stone-600"> · {minutesLabel(walk)}</span>}
                </p>
                {hoursLine(stop) && <p className="text-xs text-stone-600">{hoursLine(stop)}</p>}
                {showAccess && (
                  <p className="text-xs text-stone-600">{stop.tips?.wheelchair ? accessText(stop.tips.wheelchair, lang) : L('Access not yet checked', 'لم يُتحقق من الدخول بعد')}</p>
                )}
                {description && <p className="text-xs text-stone-700" lang={fallbackLang(stop, 'description')}>{oneLine(description)}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="mt-6 pt-4 border-t border-stone-300 flex items-center gap-4 sheet-stop">
        {qr && <div className="w-24 h-24 shrink-0 [&>svg]:w-full [&>svg]:h-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />}
        <div className="text-xs text-stone-700">
          <p className="font-bold">{L('Scan to open this walk in the app, with audio guides that work offline.', 'امسح الرمز لفتح هذه الجولة في التطبيق، مع أدلة صوتية تعمل دون إنترنت.')}</p>
          <p className="mt-1 break-all text-stone-500" dir="ltr">{url}</p>
          <p className="mt-1 text-stone-500">{L('Hours can change on holidays and during Ramadan.', 'قد تتغير المواعيد في الأعياد وخلال شهر رمضان.')}</p>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
