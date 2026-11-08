import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Car, Navigation, TrainFront, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { directionsUrl, gettingThere } from '../lib/getting-there';
import { useDialog } from '../lib/useDialog';
import { L, byLang, currentLang, fallbackLang, nameOf } from '../i18n/lang';

const metroLine = (station: string, minutes: number | null) =>
  minutes
    ? byLang({
        en: `Nearest metro: ${station} · ${minutes} min walk`,
        ar: `أقرب محطة مترو: ${station} · ${minutes === 1 ? 'دقيقة واحدة' : minutes === 2 ? 'دقيقتان' : `${minutes} ${minutes <= 10 ? 'دقائق' : 'دقيقة'}`} سيرًا`,
        fr: `Métro le plus proche : ${station} · ${minutes} min à pied`,
        es: `Metro más cercano: ${station} · ${minutes} min a pie`,
      })
    : byLang({ en: `Nearest metro: ${station}`, ar: `أقرب محطة مترو: ${station}`, fr: `Métro le plus proche : ${station}`, es: `Metro más cercano: ${station}` });

/**
 * "Getting there" under a route's actions: where the walk starts, directions
 * to it, the nearest metro station, the admin's note, and a card with the
 * start's Arabic name to show a taxi driver.
 */
export function GettingThere({ route, places, className = '' }: { route: Route; places: Location[]; className?: string }) {
  const [driver, setDriver] = useState(false);
  const info = gettingThere(route, places, currentLang());
  if (!info) return null;
  const { start, metro, minutes, note } = info;
  return (
    <section aria-labelledby="getting-there" className={`w-full max-w-md rounded-2xl border border-sand/60 bg-white/70 p-4 text-start ${className}`}>
      <h3 id="getting-there" className="text-xs font-bold uppercase tracking-widest text-stone-500">{L('Getting there', 'الوصول إلى البداية')}</h3>
      <p className="mt-1 text-sm text-ink">
        {L('The walk starts at', 'تبدأ الجولة من')} <span className="font-bold" lang={fallbackLang(start, 'name')}>{nameOf(start)}</span>
      </p>
      {metro && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-stone-600">
          <TrainFront className="mt-0.5 w-3.5 h-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
          <span lang={metro.lang}>{metroLine(metro.text, minutes)}</span>
        </p>
      )}
      {note && <p className="mt-1 text-xs text-stone-600" lang={note.lang}>{note.text}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={directionsUrl(start)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-chalk text-xs font-bold text-ink hover:bg-sand/40"
        >
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
          {L('Directions', 'الاتجاهات')}
        </a>
        <button
          type="button"
          onClick={() => setDriver(true)}
          className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-chalk text-xs font-bold text-ink hover:bg-sand/40"
        >
          <Car className="w-3.5 h-3.5" aria-hidden="true" />
          {L('Show the driver', 'اعرضها على السائق')}
        </button>
      </div>
      {driver && <DriverCard place={start} route={route} onClose={() => setDriver(false)} />}
    </section>
  );
}

/** Full screen, in large Arabic whatever the app's language: where to go, to show a taxi driver. */
function DriverCard({ place, route, onClose }: { place: Location; route: Route; onClose: () => void }) {
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  return createPortal(
    <div className="fixed inset-0 z-[6000] bg-white overflow-y-auto">
      <span {...guard('start')} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="driver-place" className="min-h-full flex flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-stone-600">{L('Show this to your driver', 'اعرض هذه الشاشة على السائق')}</p>
          <button type="button" onClick={onClose} aria-label={L('Close', 'إغلاق')} className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-chalk text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div lang="ar" dir="rtl" className="flex-1 flex flex-col justify-center text-center font-arabic py-10">
          <p className="text-2xl text-stone-600">من فضلك، أريد الذهاب إلى:</p>
          <p id="driver-place" className="mt-4 text-5xl sm:text-6xl font-bold leading-tight text-ink">{place.nameAr}</p>
          <p className="mt-4 text-3xl text-stone-700">{route.nameAr}، القاهرة</p>
        </div>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
