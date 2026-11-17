import React, { lazy, useState } from 'react';
import { Binoculars, Hourglass, Stamp as StampIcon } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { stampCount, stampDate, useStamps, type Stamp } from '../lib/passport';
import type { Best } from '../lib/quiz-best';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';

// The sheet loads only when opened (and is in the offline cache like the rest of the app).
const PassportSheetLazy = lazy(() => import('./PassportSheet'));

/** The passport sheet, loaded when it's opened. */
export function PassportSheet(props: { routes: Route[]; places?: Location[]; onClose: () => void; onShowRoute?: (id: string) => void }) {
  return (
    <LazyBoundary loading={null} failed={<SheetFailed onClose={props.onClose} />}>
      <PassportSheetLazy {...props} />
    </LazyBoundary>
  );
}

export const walksLabel = (n: number, total: number) =>
  byLang({
    en: `${n} of ${total} walks`,
    ar: `${n} من ${total} جولات`,
    fr: `${n} visite${n === 1 ? '' : 's'} sur ${total}`,
    es: `${n} de ${total} paseos`,
  });

const spotsLabel = (s: Stamp) =>
  byLang({ en: `Spotted ${s.found} of ${s.spots}`, ar: `وجدت ${s.found} من ${s.spots}`, fr: `Repéré ${s.found} sur ${s.spots}`, es: `Encontrado ${s.found} de ${s.spots}` });

/** One stamp: the route's name and the day it was finished; dashed and grey until then. */
/** `quiz`: the best "Which came first?" score on the route, shown under the stamp. */
export function StampBadge({ route, stamp, quiz, size = 'md' }: { route: Route; stamp?: Stamp; quiz?: Best; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-36 h-36' : 'w-28 h-28 sm:w-32 sm:h-32';
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={`${box} rounded-full flex flex-col items-center justify-center p-3 ${
          stamp ? 'border-4 border-gold bg-gold/15 -rotate-6' : 'border-2 border-dashed border-sand text-stone-400'
        }`}
      >
        <span className={`text-xs font-bold leading-tight line-clamp-3 ${stamp ? 'text-ink' : ''}`}>{nameOf(route)}</span>
        {stamp ? (
          <span className="mt-1 text-[11px] font-bold text-gold-ink">{stampDate(stamp.date, currentLang())}</span>
        ) : (
          <span className="mt-1 text-[11px]">{L('Not yet', 'ليس بعد')}</span>
        )}
      </div>
      {stamp && stamp.spots > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-stone-500">
          <Binoculars className="w-3 h-3" aria-hidden="true" />
          {spotsLabel(stamp)}
        </span>
      )}
      {quiz && (
        <span className="flex items-center gap-1 text-[11px] text-stone-500">
          <Hourglass className="w-3 h-3" aria-hidden="true" />
          {byLang({ en: `Quiz ${quiz.score}/${quiz.of}`, ar: `المسابقة ${quiz.score}/${quiz.of}`, fr: `Quiz ${quiz.score}/${quiz.of}`, es: `Juego ${quiz.score}/${quiz.of}` })}
        </span>
      )}
    </div>
  );
}

/** "Passport 1/5" beside Saved, over the routes. */
export function PassportButton({ routes, places, onShowRoute }: { routes: Route[]; places?: Location[]; onShowRoute?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const stamps = useStamps();
  const n = stampCount(stamps, routes);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex shrink-0 items-center gap-2 min-h-11 px-3 sm:px-4 rounded-full border border-sand bg-white text-xs font-bold uppercase tracking-widest text-ink shadow-sm hover:border-nile transition-colors"
      >
        <StampIcon className={`w-4 h-4 ${n ? 'text-gold-ink' : 'text-stone-500'}`} aria-hidden="true" />
        {/* On phones, the stamp and the count only, so Saved still fits beside it. */}
        <span className="sr-only sm:not-sr-only">{L('Passport', 'جواز السفر')}</span>
        <span className="tabular-nums tracking-normal text-stone-500" aria-hidden="true">{n}/{routes.length}</span>
        <span className="sr-only"> ({walksLabel(n, routes.length)})</span>
      </button>
      {open && <PassportSheet routes={routes} places={places} onClose={() => setOpen(false)} onShowRoute={onShowRoute && (id => { setOpen(false); onShowRoute(id); })} />}
    </>
  );
}
