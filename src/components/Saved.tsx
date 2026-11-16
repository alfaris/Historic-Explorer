import React, { lazy, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { toggleSaved, useSaved } from '../lib/saved';
import { L, byLang, nameOf } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';

// The sheets load only when opened (and are in the offline cache like the rest of the app).
const SavedSheet = lazy(() => import('./SavedSheets').then(m => ({ default: m.SavedSheet })));
const SharedListSheetLazy = lazy(() => import('./SavedSheets').then(m => ({ default: m.SharedListSheet })));

/**
 * Save a place to find it again. `icon`: a round bookmark button (rows, walk
 * mode); `full`: a labelled button beside "Mark visited" on the full card.
 */
export function SaveToggle({ place, variant = 'icon', className = '' }: { place: Location; variant?: 'icon' | 'full'; className?: string }) {
  const saved = useSaved().has(place.id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaved(place.id);
  };
  if (variant === 'full') {
    return (
      <button
        onClick={onClick}
        aria-pressed={saved}
        className={`flex justify-center items-center gap-2 px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
          saved ? 'bg-gold/25 text-ink hover:bg-gold/35' : 'bg-chalk text-ink hover:bg-sand/30'
        } ${className}`}
      >
        <Icon className={`w-4 h-4 ${saved ? 'fill-gold/40' : ''}`} aria-hidden="true" />
        {saved ? L('Saved', 'محفوظ') : L('Save', 'حفظ')}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={`${L('Save', 'حفظ')}: ${nameOf(place)}`}
      title={saved ? L('Saved', 'محفوظ') : L('Save', 'حفظ')}
      className={`flex items-center justify-center min-w-11 min-h-11 rounded-full transition-colors ${
        saved ? 'text-gold-ink bg-gold/15 hover:bg-gold/25' : 'text-stone-400 hover:text-nile hover:bg-chalk'
      } ${className}`}
    >
      <Icon className={`w-5 h-5 ${saved ? 'fill-gold/40' : ''}`} aria-hidden="true" />
    </button>
  );
}

/** "3 saved places" etc. */
export const countLabel = (n: number) =>
  byLang({
    en: n === 1 ? '1 saved place' : `${n} saved places`,
    ar: n === 1 ? 'مكان محفوظ واحد' : n === 2 ? 'مكانان محفوظان' : n <= 10 ? `${n} أماكن محفوظة` : `${n} مكانًا محفوظًا`,
    fr: n === 1 ? '1 lieu enregistré' : `${n} lieux enregistrés`,
    es: n === 1 ? '1 lugar guardado' : `${n} lugares guardados`,
  });

/** A shared list of places (a link from "Share list"), loaded when one is opened. */
export function SharedListSheet(props: { ids: number[]; places: Location[]; routes: Route[]; onOpen: (id: number) => void; onClose: () => void }) {
  return (
    <LazyBoundary loading={null} failed={<SheetFailed onClose={props.onClose} />}>
      <SharedListSheetLazy {...props} />
    </LazyBoundary>
  );
}

/**
 * "Saved" with the number of saved places (beside the routes' heading),
 * opening the list of them across every route.
 */
export function SavedButton({ places, routes, onOpen }: { places: Location[]; routes: Route[]; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const saved = useSaved();
  // Count only places that still exist.
  const count = places.filter(p => saved.has(p.id)).length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group flex shrink-0 items-center gap-2 min-h-11 px-4 rounded-full border border-sand bg-white text-xs font-bold uppercase tracking-widest text-ink shadow-sm hover:border-nile transition-colors"
      >
        <Bookmark className={`w-4 h-4 ${count ? 'text-gold-ink fill-gold/40' : 'text-stone-500'}`} aria-hidden="true" />
        {byLang({ en: 'Saved', ar: 'المحفوظات', fr: 'Enregistrés', es: 'Guardados' })}
        {count > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-nile text-white text-xs font-bold leading-5 text-center tabular-nums tracking-normal" aria-hidden="true">
            {count}
          </span>
        )}
        <span className="sr-only"> ({countLabel(count)})</span>
      </button>
      {open && (
        <LazyBoundary loading={null} failed={<SheetFailed onClose={() => setOpen(false)} />}>
          <SavedSheet places={places} routes={routes} onOpen={onOpen} onClose={() => setOpen(false)} />
        </LazyBoundary>
      )}
    </>
  );
}
