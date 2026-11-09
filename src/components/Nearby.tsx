import React from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import type { Location } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { nearbyOnOtherRoutes } from '../lib/nearby';
import { L, byLang, currentLang, fallbackLang, nameOf } from '../i18n/lang';

const minutesWalk = (n: number) =>
  byLang({
    en: `${n} min walk`,
    ar: `${n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتان' : `${n} ${n <= 10 ? 'دقائق' : 'دقيقة'}`} سيرًا`,
    fr: `${n} min à pied`,
    es: `${n} min a pie`,
  });

/**
 * "Nearby": up to three places on other routes a short walk from this one,
 * each opening its card. Nothing when there are none.
 */
export function Nearby({ place, onOpen, className = 'mb-6' }: { place: Location; onOpen: (id: number) => void; className?: string }) {
  const { places, routes } = useContent();
  const near = nearbyOnOtherRoutes(place, places);
  if (!near.length) return null;
  const ar = currentLang() === 'ar';
  const routeName = (id: string) => {
    const r = routes.find(x => x.id === id);
    return r ? nameOf(r) : '';
  };
  return (
    <section aria-labelledby={`nearby-${place.id}`} className={`rounded-2xl border border-sand/60 p-4 ${className}`}>
      <h3 id={`nearby-${place.id}`} className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">{L('Nearby on other routes', 'بالقرب على مسارات أخرى')}</h3>
      <ul className="divide-y divide-sand/40">
        {near.map(({ place: p, minutes }) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation(); // The card behind it opens and closes on click.
                onOpen(p.id);
              }}
              className="flex w-full min-h-11 items-center gap-3 py-2 text-start hover:text-nile"
            >
              <MapPin className="w-4 h-4 shrink-0 text-gold-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink" lang={fallbackLang(p, 'name')}>{nameOf(p)}</span>
                <span className="block truncate text-xs text-stone-500">
                  {routeName(p.routeId)} · {minutesWalk(minutes)}
                </span>
              </span>
              <ChevronRight className={`w-4 h-4 shrink-0 text-stone-300 ${ar ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
