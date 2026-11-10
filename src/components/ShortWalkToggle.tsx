import React from 'react';
import { Zap } from 'lucide-react';
import { L, byLang } from '../i18n/lang';
import { setShortWalk } from '../lib/short-walk';

const stopsLabel = (n: number) =>
  byLang({ en: `${n} must-see stops`, ar: `${n} ${n <= 10 ? 'محطات' : 'محطة'} لا تفوّت`, fr: `${n} étapes incontournables`, es: `${n} paradas imprescindibles` });

/** The short walk's length and time: "1.1 km · about 25 min". */
export const shortWalkMeta = (meters: number, minutes: number) => {
  const km = Math.round(meters / 100) / 10;
  return byLang({
    en: `${km} km · about ${minutes} min`,
    ar: `${km} كم · حوالي ${minutes === 1 ? 'دقيقة واحدة' : minutes === 2 ? 'دقيقتين' : `${minutes} ${minutes <= 10 ? 'دقائق' : 'دقيقة'}`}`,
    fr: `${String(km).replace('.', ',')} km · environ ${minutes} min`,
    es: `${String(km).replace('.', ',')} km · unos ${minutes} min`,
  });
};

/**
 * "Short walk": a switch beside a route's distance and time, for a route with
 * must-see stops. On, the list, map and walk show only those stops.
 */
export function ShortWalkToggle({ routeId, on, stops, className = '' }: { routeId: string; on: boolean; stops: number; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setShortWalk(routeId, !on)}
      className={`inline-flex items-center gap-2 min-h-11 px-4 rounded-full border text-xs font-bold transition-colors ${
        on ? 'bg-nile text-white border-nile' : 'bg-white text-nile border-nile/30 hover:border-nile'
      } ${className}`}
    >
      <Zap className={`w-3.5 h-3.5 ${on ? 'text-gold' : 'text-gold-ink'}`} aria-hidden="true" />
      <span>{L('Short walk', 'جولة قصيرة')}</span>
      <span className={`font-normal ${on ? 'text-white/80' : 'text-stone-500'}`}>· {stopsLabel(stops)}</span>
      <span aria-hidden="true" className={`ms-1 relative w-8 h-4 rounded-full ${on ? 'bg-gold' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'end-0.5' : 'start-0.5'}`} />
      </span>
    </button>
  );
}
