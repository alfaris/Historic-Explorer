import React from 'react';
import { Check, CircleCheck, RotateCcw } from 'lucide-react';
import { clearVisited, toggleVisited, useVisited } from '../lib/visited';

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
      {visited ? (isArabic ? 'تمت الزيارة' : 'Visited') : isArabic ? 'تمت زيارته؟' : 'Mark visited'}
    </button>
  );
}

/** Small check shown on a visited place's card. */
export function VisitedBadge({ placeId, isArabic }: { placeId: number; isArabic: boolean }) {
  if (!useVisited().has(placeId)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-nile">
      <CircleCheck className="w-3.5 h-3.5" />
      {isArabic ? 'تمت الزيارة' : 'Visited'}
    </span>
  );
}

/** "6 / 14 visited" with a progress bar, for one route. */
export function RouteProgress({ placeIds, isArabic }: { placeIds: number[]; isArabic: boolean }) {
  const visited = useVisited();
  const done = placeIds.filter(id => visited.has(id)).length;
  const total = placeIds.length;
  if (total === 0) return null;

  return (
    <div className="w-full max-w-xs mb-8" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-2 text-[10px] font-bold uppercase tracking-widest text-nile">
        <span>
          {isArabic ? `زرت ${done} من ${total}` : `${done} / ${total} visited`}
        </span>
        {done > 0 && (
          <button
            onClick={() => {
              const message = isArabic ? 'مسح تقدم الزيارة لهذا المسار؟' : 'Clear your visited places on this route?';
              if (window.confirm(message)) clearVisited(placeIds);
            }}
            className="flex items-center gap-1 text-stone-400 hover:text-nile transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {isArabic ? 'إعادة' : 'Reset'}
          </button>
        )}
      </div>
      <div
        className="h-1.5 rounded-full bg-sand/40 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={isArabic ? 'تقدم المسار' : 'Route progress'}
      >
        <div className="h-full bg-nile rounded-full transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}
