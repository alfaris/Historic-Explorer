import React, { lazy, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { L } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';

// The timetable loads only when opened (and is in the offline cache like the rest of the app).
const PlanVisitDialog = lazy(() => import('./PlanVisitDialog'));

/**
 * "Plan my visit": a timetable for the route's stops from a chosen day and
 * start time, flagging closures and prayer pauses, with a better start time
 * when there is one. Works offline.
 */
export function PlanVisit({ route, places, walkPlaces, onOpenPlace, compactOnPhone = false }: {
  route: Route;
  places: Location[];
  /** The places the walk's stops come from, when the short walk leaves some out. */
  walkPlaces?: Location[];
  onOpenPlace: (id: number) => void;
  compactOnPhone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex items-center justify-center gap-2 min-h-12 py-3.5 rounded-2xl bg-white border border-sand text-ink text-xs font-bold uppercase tracking-widest shadow-sm hover:border-nile transition-colors ${compactOnPhone ? 'min-w-12 px-3.5 sm:px-5' : 'px-5'}`}
      >
        <CalendarClock className="w-4 h-4 text-stone-500" aria-hidden="true" />
        <span className={compactOnPhone ? 'sr-only sm:not-sr-only' : undefined}>{L('Plan my visit', 'خطط لزيارتك')}</span>
      </button>
      {open && (
        <LazyBoundary loading={null} failed={<SheetFailed onClose={() => setOpen(false)} />}>
          <PlanVisitDialog route={route} places={places} walkPlaces={walkPlaces} onClose={() => setOpen(false)} onOpenPlace={onOpenPlace} />
        </LazyBoundary>
      )}
    </>
  );
}
