import React from 'react';
import { ArrowRight, Footprints, PartyPopper, TrainFront } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { photoForRoute, photoAltOf } from '../data/photo-resolve';
import { formatDistance } from '../lib/geo';
import { nextWalk } from '../lib/next-walk';
import { useStamps } from '../lib/passport';
import { L, byLang, currentLang, nameOf, optionalText } from '../i18n/lang';
import { PlacePhoto } from './PlacePhoto';

const minutesOnFoot = (n: number) =>
  byLang({
    en: `about ${n} min on foot`,
    ar: `حوالي ${n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتين' : `${n} ${n <= 10 ? 'دقائق' : 'دقيقة'}`} سيرًا`,
    fr: `environ ${n} min à pied`,
    es: `unos ${n} min a pie`,
  });

/**
 * "Next walk": the nearest route not yet in the passport, from where `fromRoute`
 * ends, with how far its start is and Show this walk. When every route has
 * its stamp, says so. Nothing when there's nothing to suggest.
 */
export function NextWalk({ fromRouteId, routes, places, onShowRoute, className = '' }: {
  fromRouteId: string;
  routes: Route[];
  places: Location[];
  onShowRoute: (id: string) => void;
  className?: string;
}) {
  const stamps = useStamps();
  const next = nextWalk(fromRouteId, routes, places, stamps);
  if (!next) return null;
  const ar = currentLang() === 'ar';

  if (next.kind === 'allDone') {
    return (
      <p className={`flex items-center justify-center gap-2 rounded-2xl bg-chalk p-3 text-sm font-bold text-ink ${className}`}>
        <PartyPopper className="w-4 h-4 text-gold-ink shrink-0" aria-hidden="true" />
        {byLang({
          en: `You've walked all ${routes.length} routes. Well done!`,
          ar: `لقد مشيت كل المسارات (${routes.length}). أحسنت!`,
          fr: `Vous avez fait les ${routes.length} parcours. Bravo !`,
          es: `Has hecho los ${routes.length} recorridos. ¡Enhorabuena!`,
        })}
      </p>
    );
  }

  const { route, meters, minutes, far } = next;
  const metro = optionalText(route, 'metro');
  const away = byLang({
    en: `Starts ${formatDistance(meters, ar)} away`,
    ar: `يبدأ على بعد ${formatDistance(meters, ar)}`,
    fr: `Départ à ${formatDistance(meters, ar)}`,
    es: `Empieza a ${formatDistance(meters, ar)}`,
  });
  const how = !far
    ? minutesOnFoot(minutes)
    : metro.text
      ? byLang({ en: `metro: ${metro.text}`, ar: `المترو: ${metro.text}`, fr: `métro : ${metro.text}`, es: `metro: ${metro.text}` })
      : L('best by taxi or metro', 'الأفضل بالتاكسي أو المترو');
  const Icon = far ? TrainFront : Footprints;

  return (
    <section aria-labelledby="next-walk-title" className={`rounded-2xl border border-sand/60 p-3 text-start ${className}`}>
      <p id="next-walk-title" className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">{L('Next walk', 'الجولة التالية')}</p>
      <div className="flex items-center gap-3">
        <PlacePhoto
          photo={photoForRoute(route)}
          alt={photoAltOf(route)}
          className="w-16 h-16 shrink-0 rounded-xl overflow-hidden"
          sizes="64px"
          tapToShow={false}
          fallback={<div className="w-16 h-16 shrink-0 rounded-xl bg-nile/10" />}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-base text-ink leading-tight ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{nameOf(route)}</p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-stone-600">
            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span>
              {away} · <span lang={far && metro.text ? metro.lang : undefined}>{how}</span>
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onShowRoute(route.id)}
        className="mt-3 flex w-full items-center justify-center gap-2 min-h-11 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest hover:bg-nile-light"
      >
        {L('Show this walk', 'اعرض هذه الجولة')}
        <ArrowRight className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </section>
  );
}
