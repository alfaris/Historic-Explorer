import React from 'react';
import { Clock } from 'lucide-react';
import type { Location } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { routeOpenNow } from '../lib/open-now';
import { walkStops } from '../lib/walk';
import { byLang } from '../i18n/lang';
import { useNow } from './PlaceHours';

/** "Open now: 6 of 9 stops · 2 close within the hour" for a route; nothing when no stop has hours. */
export function RouteOpenNow({ routeId, places, className = '' }: { routeId: string; places: Location[]; className?: string }) {
  const now = useNow();
  const { specialPeriods } = useContent();
  const { known, open, closingSoon } = routeOpenNow(walkStops(places, routeId), now, specialPeriods);
  if (!known) return null;
  const main = byLang({
    en: `Open now: ${open} of ${known} ${known === 1 ? 'stop' : 'stops'} with hours`,
    ar: `مفتوح الآن: ${open} من ${known} ${known <= 10 && known > 2 ? 'محطات' : 'محطة'} لها مواعيد`,
    fr: `Ouvert maintenant : ${open} sur ${known} ${known === 1 ? 'étape' : 'étapes'} avec horaires`,
    es: `Abierto ahora: ${open} de ${known} ${known === 1 ? 'parada' : 'paradas'} con horario`,
  });
  const soon = closingSoon
    ? byLang({
        en: `${closingSoon} ${closingSoon === 1 ? 'closes' : 'close'} within the hour`,
        ar: closingSoon === 1 ? 'واحدة تُغلق خلال ساعة' : `${closingSoon} تُغلق خلال ساعة`,
        fr: `${closingSoon} ${closingSoon === 1 ? 'ferme' : 'ferment'} dans l’heure`,
        es: `${closingSoon} ${closingSoon === 1 ? 'cierra' : 'cierran'} en menos de una hora`,
      })
    : '';
  return (
    <p className={`flex items-center gap-1.5 text-xs text-stone-600 ${className}`}>
      <Clock className="w-3.5 h-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
      <span>
        {main}
        {soon && <span className="text-amber-800"> · {soon}</span>}
      </span>
    </p>
  );
}
