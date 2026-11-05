import React from 'react';
import { ChevronRight, ChevronLeft, MapPin } from 'lucide-react';
import { categories, type Location, type Route } from '../data/locations';

import { L, nameOf } from '../i18n/lang';
/**
 * Search matches on routes other than the one shown. Each opens its place,
 * switching to its route.
 */
export function OtherRouteResults({ places, routes, isArabic, onOpen }: {
  places: Location[];
  routes: Route[];
  isArabic: boolean;
  onOpen: (id: number) => void;
}) {
  if (places.length === 0) return null;
  const routeName = (id: string) => {
    const r = routes.find(x => x.id === id);
    return r ? (nameOf(r)) : id;
  };
  const Arrow = isArabic ? ChevronLeft : ChevronRight;
  return (
    <section aria-labelledby="other-route-results" className="bg-white rounded-3xl border border-sand/50 p-5 md:p-6">
      <h3 id="other-route-results" className="text-xs font-bold uppercase tracking-[0.2em] text-nile mb-3">
        {`${L('Also on other routes', 'في مسارات أخرى')} (${places.length})`}
      </h3>
      <ul className="divide-y divide-sand/40">
        {places.map(p => {
          const category = categories.find(c => c.id === p.category);
          return (
            <li key={p.id}>
              <button onClick={() => onOpen(p.id)} className="w-full flex items-center gap-3 py-3 text-start group">
                <MapPin className="w-4 h-4 shrink-0 text-gold" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-ink truncate group-hover:text-nile">{nameOf(p)}</span>
                  <span className="block text-xs text-stone-500 truncate">
                    {routeName(p.routeId)}
                    {category ? ` · ${nameOf(category)}` : ''}
                  </span>
                </span>
                <Arrow className="w-4 h-4 shrink-0 text-stone-400 group-hover:text-nile" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
