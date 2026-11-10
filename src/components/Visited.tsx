import React from 'react';
import { Check, CircleCheck, RotateCcw } from 'lucide-react';
import { clearVisited, toggleVisited, useVisited } from '../lib/visited';

import { removeSkipped, useSkipped } from '../lib/skipped';
import { L, currentLang, byLang } from '../i18n/lang';
/** Button to mark the place as visited, or undo it. */
export function VisitedToggle({ placeId, isArabic, className = '' }: { placeId: number; isArabic: boolean; className?: string }) {
  const visited = useVisited().has(placeId);
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        toggleVisited(placeId);
      }}
      aria-pressed={visited}
      className={`flex justify-center items-center gap-2 px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
        visited ? 'bg-nile text-white hover:bg-nile-light' : 'bg-chalk text-ink hover:bg-sand/30'
      } ${className}`}
    >
      {visited ? <CircleCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      {visited ? (L('Visited', 'تمت الزيارة')) : L('Mark visited', 'تمت زيارته؟')}
    </button>
  );
}

/** Small check shown on a visited place's card. */
export function VisitedBadge({ placeId, isArabic }: { placeId: number; isArabic: boolean }) {
  if (!useVisited().has(placeId)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-nile">
      <CircleCheck className="w-3.5 h-3.5" />
      {L('Visited', 'تمت الزيارة')}
    </span>
  );
}

/**
 * "6 / 20 stops visited" with a progress bar, for one route. Counts the
 * route's stops (`placeIds`); Reset clears `clearIds` (the whole route,
 * extras included) when given.
 */
export function RouteProgress({ placeIds, clearIds = placeIds, isArabic }: { placeIds: number[]; clearIds?: number[]; isArabic: boolean }) {
  const visited = useVisited();
  const skipped = useSkipped();
  const done = placeIds.filter(id => visited.has(id)).length;
  const total = placeIds.length;
  if (total === 0) return null;

  return (
    <div className="w-full max-w-xs mb-8" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-2 text-xs font-bold uppercase tracking-widest text-nile">
        <span>
          {byLang({ en: `${done} / ${total} stops visited`, ar: `زرت ${done} من ${total} محطة`, fr: `${done} / ${total} étapes visitées`, es: `${done} / ${total} paradas visitadas` })}
        </span>
        {/* Reset whenever anything on the route is marked, extras included, even with no stop visited yet. */}
        {clearIds.some(id => visited.has(id) || skipped.has(id)) && (
          <button
            onClick={() => {
              const message = L('Clear your visited places on this route?', 'مسح تقدم الزيارة لهذا المسار؟');
              if (window.confirm(message)) {
                clearVisited(clearIds);
                removeSkipped(clearIds);
              }
            }}
            className="flex items-center gap-1 text-stone-400 hover:text-nile transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {L('Reset', 'إعادة')}
          </button>
        )}
      </div>
      <div
        className="h-1.5 rounded-full bg-sand/40 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={L('Route progress', 'تقدم المسار')}
      >
        <div className="h-full bg-nile rounded-full transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}
