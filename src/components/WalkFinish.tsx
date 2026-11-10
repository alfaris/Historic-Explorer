import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Binoculars, Clock, Flag, Footprints, RotateCcw, X } from 'lucide-react';
import { spotCount, spotted } from '../lib/spot-it';
import type { Location, Route } from '../data/locations';
import { photoForRoute, photoAltOf } from '../data/photo-resolve';
import { formatDistance } from '../lib/geo';
import { useDialog } from '../lib/useDialog';
import { clearVisited, useVisited } from '../lib/visited';
import { walkSummary } from '../lib/walk-summary';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';
import { PlacePhoto } from './PlacePhoto';
import { ShareRoute } from './ShareRoute';
import { PostcardButton } from './PostcardButton';
import { RouteRating } from './RouteRating';
import { StampBadge } from './Passport';
import { stampRoute, useStamps } from '../lib/passport';
import { cairoDate } from '../lib/special-hours';
import { removeSkipped, useSkipped } from '../lib/skipped';
import { NextWalk } from './NextWalk';

/**
 * The end of a walk: stops visited, roughly how far the visitor walked (from
 * the walk plan), the route's photo, "How was the walk?", a share button and
 * "Walk again". The rating is sent with the anonymous usage counts; nothing
 * else here leaves the device.
 */
export function WalkFinish({ route, routes, places, onClose, onShowPassport, onShowRoute }: {
  route: Route;
  /** All routes, for the Next walk suggestion. */
  routes?: Route[];
  places: Location[];
  onClose: () => void;
  onShowPassport?: () => void;
  onShowRoute?: (id: string) => void;
}) {
  const visited = useVisited();
  const summary = walkSummary(places, route.id, visited);
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = currentLang() === 'ar';
  const photo = photoForRoute(route);
  // "Spot it" challenges found on this route.
  const spots = spotCount(places, route.id, spotted.useIds());
  // Every stop visited: the route's stamp in the passport (the first finish keeps its date).
  useEffect(() => {
    if (summary.complete) stampRoute(route.id, cairoDate(new Date()), spots);
  }, [summary.complete, route.id, spots.found, spots.total]); // eslint-disable-line react-hooks/exhaustive-deps
  const stamp = useStamps()[route.id];
  // Stops skipped in walk mode and not visited since.
  const skipped = useSkipped();
  const skippedCount = summary.stopIds.filter(id => skipped.has(id) && !visited.has(id)).length;

  const walkAgain = () => {
    if (!window.confirm(L('Start this route again? Your visited marks on it will be cleared.', 'هل تريد بدء هذا المسار من جديد؟ سيتم مسح علامات الزيارة الخاصة به.'))) return;
    const ids = places.filter(p => p.routeId === route.id).map(p => p.id);
    clearVisited(ids);
    removeSkipped(ids);
    onClose();
  };

  const title = summary.complete ? L('Walk complete!', 'اكتملت الجولة!') : L('Walk finished', 'انتهت الجولة');

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-finish-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-3 end-3 z-10 p-2.5 rounded-full bg-white/90 text-stone-600 hover:text-ink shadow"
          aria-label={L('Close', 'إغلاق')}
        >
          <X className="w-5 h-5" />
        </button>
        <PlacePhoto photo={photo} alt={photoAltOf(route)} className="w-full h-44" sizes="(min-width: 448px) 448px, 100vw" fallback={<div className="h-20 bg-nile/10" />} />
        <div className="p-6 text-center">
          <Flag className="w-8 h-8 text-gold mx-auto mb-2" aria-hidden="true" />
          <h2 id="walk-finish-title" className={`text-3xl text-ink mb-1 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{title}</h2>
          <p className="text-sm text-stone-500 mb-5">{nameOf(route)}</p>

          <dl className="grid grid-cols-3 gap-2 mb-6 text-center">
            <div className="rounded-2xl bg-chalk p-3">
              <dt className="sr-only">{L('Stops', 'المحطات')}</dt>
              <dd>
                <Flag className="w-4 h-4 text-nile mx-auto mb-1" aria-hidden="true" />
                <span className="block text-lg font-bold text-ink">{summary.visited}/{summary.total}</span>
                <span className="block text-xs text-stone-500">{L('stops', 'محطات')}</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-chalk p-3">
              <dt className="sr-only">{L('Distance walked', 'المسافة المقطوعة')}</dt>
              <dd>
                <Footprints className="w-4 h-4 text-nile mx-auto mb-1" aria-hidden="true" />
                <span className="block text-lg font-bold text-ink">{summary.meters ? `≈ ${formatDistance(summary.meters, ar)}` : '–'}</span>
                <span className="block text-xs text-stone-500">{L('walked', 'مشيًا')}</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-chalk p-3">
              <dt className="sr-only">{L('Walking time', 'وقت المشي')}</dt>
              <dd>
                <Clock className="w-4 h-4 text-nile mx-auto mb-1" aria-hidden="true" />
                <span className="block text-lg font-bold text-ink">{summary.minutes ? `≈ ${summary.minutes}` : '–'}</span>
                <span className="block text-xs text-stone-500">{L('min walking', 'دقيقة مشي')}</span>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-stone-400 mb-5">{L('Estimated from the walk between the stops you visited.', 'تقدير من المسافة بين المحطات التي زرتها.')}</p>
          {skippedCount > 0 && (
            <p className="text-sm text-stone-600 -mt-3 mb-5">
              {byLang({
                en: `${skippedCount} ${skippedCount === 1 ? 'stop' : 'stops'} skipped: visit ${skippedCount === 1 ? 'it' : 'them'} to get this route's stamp.`,
                ar: `تخطيت ${skippedCount} ${skippedCount === 1 ? 'محطة' : skippedCount === 2 ? 'محطتين' : 'محطات'}: زرها لتحصل على ختم هذا المسار.`,
                fr: `${skippedCount} étape${skippedCount > 1 ? 's' : ''} passée${skippedCount > 1 ? 's' : ''} : visitez-l${skippedCount > 1 ? 'es' : 'a'} pour obtenir le tampon de ce parcours.`,
                es: `${skippedCount} parada${skippedCount > 1 ? 's' : ''} omitida${skippedCount > 1 ? 's' : ''}: visítala${skippedCount > 1 ? 's' : ''} para conseguir el sello de este recorrido.`,
              })}
            </p>
          )}

          {spots.total > 0 && (
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-ink mb-5">
              <Binoculars className="w-4 h-4 text-gold-ink" aria-hidden="true" />
              {byLang({
                en: `You spotted ${spots.found} of ${spots.total}`,
                ar: `وجدت ${spots.found} من ${spots.total}`,
                fr: `Vous avez repéré ${spots.found} sur ${spots.total}`,
                es: `Has encontrado ${spots.found} de ${spots.total}`,
              })}
            </p>
          )}

          {summary.complete && stamp && (
            <div className="mb-5 flex flex-col items-center gap-2">
              <p className="text-sm font-bold text-ink">{L('A new stamp in your passport', 'ختم جديد في جواز سفرك')}</p>
              <StampBadge route={route} stamp={stamp} size="lg" />
              {onShowPassport && (
                <button type="button" onClick={onShowPassport} className="min-h-11 px-3 text-xs font-bold text-nile underline underline-offset-4 hover:no-underline">
                  {L('See my passport', 'اعرض جواز سفري')}
                </button>
              )}
            </div>
          )}

          {summary.complete && routes && onShowRoute && <NextWalk fromRouteId={route.id} routes={routes} places={places} onShowRoute={onShowRoute} className="mb-5" />}

          {summary.visited > 0 && <RouteRating routeId={route.id} className="mb-5" />}

          <div className="flex flex-col items-stretch gap-2">
            <div className="flex justify-center [&>button]:w-full [&>button]:justify-center">
              <ShareRoute route={route} />
            </div>
            {summary.visited > 0 && <PostcardButton route={route} summary={summary} title={title} />}
            <button
              onClick={walkAgain}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-chalk text-ink text-xs font-bold uppercase tracking-widest hover:bg-sand/40"
            >
              <RotateCcw className="w-4 h-4" /> {L('Walk again', 'ابدأ الجولة من جديد')}
            </button>
          </div>
        </div>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
