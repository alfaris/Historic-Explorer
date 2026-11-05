import React from 'react';
import { createPortal } from 'react-dom';
import { Clock, Flag, Footprints, RotateCcw, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { photoForRoute } from '../data/photo-resolve';
import { formatDistance } from '../lib/geo';
import { useDialog } from '../lib/useDialog';
import { clearVisited, useVisited } from '../lib/visited';
import { walkSummary } from '../lib/walk-summary';
import { L, currentLang, nameOf } from '../i18n/lang';
import { PlacePhoto } from './PlacePhoto';
import { ShareRoute } from './ShareRoute';

/**
 * The end of a walk: stops visited, roughly how far the visitor walked (from
 * the walk plan), the route's photo, a share button and "Walk again". All from
 * this device; nothing is sent anywhere.
 */
export function WalkFinish({ route, places, onClose }: { route: Route; places: Location[]; onClose: () => void }) {
  const visited = useVisited();
  const summary = walkSummary(places, route.id, visited);
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = currentLang() === 'ar';
  const photo = photoForRoute(route);

  const walkAgain = () => {
    if (!window.confirm(L('Start this route again? Your visited marks on it will be cleared.', 'هل تريد بدء هذا المسار من جديد؟ سيتم مسح علامات الزيارة الخاصة به.'))) return;
    clearVisited(places.filter(p => p.routeId === route.id).map(p => p.id));
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
        <PlacePhoto photo={photo} alt={nameOf(route)} className="w-full h-44" sizes="(min-width: 448px) 448px, 100vw" fallback={<div className="h-20 bg-nile/10" />} />
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
                <span className="block text-[11px] text-stone-500">{L('stops', 'محطات')}</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-chalk p-3">
              <dt className="sr-only">{L('Distance walked', 'المسافة المقطوعة')}</dt>
              <dd>
                <Footprints className="w-4 h-4 text-nile mx-auto mb-1" aria-hidden="true" />
                <span className="block text-lg font-bold text-ink">{summary.meters ? `≈ ${formatDistance(summary.meters, ar)}` : '–'}</span>
                <span className="block text-[11px] text-stone-500">{L('walked', 'مشيًا')}</span>
              </dd>
            </div>
            <div className="rounded-2xl bg-chalk p-3">
              <dt className="sr-only">{L('Walking time', 'وقت المشي')}</dt>
              <dd>
                <Clock className="w-4 h-4 text-nile mx-auto mb-1" aria-hidden="true" />
                <span className="block text-lg font-bold text-ink">{summary.minutes ? `≈ ${summary.minutes}` : '–'}</span>
                <span className="block text-[11px] text-stone-500">{L('min walking', 'دقيقة مشي')}</span>
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-stone-400 mb-5">{L('Estimated from the walk between the stops you visited.', 'تقدير من المسافة بين المحطات التي زرتها.')}</p>

          <div className="flex flex-col items-stretch gap-2">
            <div className="flex justify-center [&>button]:w-full [&>button]:justify-center">
              <ShareRoute route={route} />
            </div>
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
