import React, { useState } from 'react';
import { Footprints, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { useVisited } from '../lib/visited';
import { useSkipped } from '../lib/skipped';
import { routeToContinue } from '../lib/walk-summary';
import { L, byLang, nameOf } from '../i18n/lang';

const DISMISS_KEY = 'cw:continue-dismissed';
const readDismissed = () => {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * "Continue your walk": when a route has some but not all of its stops
 * visited, offers to pick it up at the next stop. "Not now" hides it for the
 * rest of this visit. All from the device, so it works offline.
 */
export function ContinueWalk({ routes, places, currentRouteId, onContinue }: {
  routes: Route[];
  places: Location[];
  currentRouteId: string;
  onContinue: (routeId: string) => void;
}) {
  const visited = useVisited();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (dismissed) return null;
  const skipped = useSkipped();
  const pick = routeToContinue(routes, places, visited, currentRouteId, skipped);
  if (!pick) return null;
  const { route, summary, next } = pick;

  const notNow = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Hidden until the page reloads.
    }
    setDismissed(true);
  };

  return (
    <section className="relative mb-6 rounded-3xl border border-gold/40 bg-white p-4 pe-12 shadow-sm" aria-labelledby="continue-walk-title">
      <button type="button" onClick={notNow} className="absolute top-2 end-2 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink" aria-label={L('Not now', 'ليس الآن')}>
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <p id="continue-walk-title" className="text-xs font-bold uppercase tracking-[0.2em] text-gold-ink">{L('Continue your walk', 'تابع جولتك')}</p>
      <p className="mt-1 text-sm text-ink">
        {nameOf(route)}
        <span className="text-stone-500">
          {' · '}
          {byLang({
            en: `${summary.visited} of ${summary.total} stops`,
            ar: `المحطات: ${summary.visited} من ${summary.total}`,
            fr: `${summary.visited} étape${summary.visited > 1 ? 's' : ''} sur ${summary.total}`,
            es: `${summary.visited} de ${summary.total} paradas`,
          })}
        </span>
      </p>
      <p className="text-xs text-stone-600">
        {L('Next stop', 'المحطة التالية')}: {nameOf(next)}
      </p>
      <button
        type="button"
        onClick={() => onContinue(route.id)}
        className="mt-3 inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest hover:bg-nile-light"
      >
        <Footprints className="w-4 h-4" aria-hidden="true" />
        {L('Continue', 'متابعة')}
      </button>
    </section>
  );
}
