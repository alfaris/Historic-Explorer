import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, ChevronRight, X } from 'lucide-react';
import { categories, type Location, type Route } from '../data/locations';
import { photoForPlace } from '../data/photo-resolve';
import { removeSaved, savedByRoute, toggleSaved, useSaved } from '../lib/saved';
import { useDialog } from '../lib/useDialog';
import { L, byLang, currentLang, fallbackLang, nameOf } from '../i18n/lang';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { PlacePhoto } from './PlacePhoto';

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
const countLabel = (n: number) =>
  byLang({
    en: n === 1 ? '1 saved place' : `${n} saved places`,
    ar: n === 1 ? 'مكان محفوظ واحد' : n === 2 ? 'مكانان محفوظان' : n <= 10 ? `${n} أماكن محفوظة` : `${n} مكانًا محفوظًا`,
    fr: n === 1 ? '1 lieu enregistré' : `${n} lieux enregistrés`,
    es: n === 1 ? '1 lugar guardado' : `${n} lugares guardados`,
  });

function SavedSheet({ places, routes, onOpen, onClose }: {
  places: Location[];
  routes: Route[];
  onOpen: (id: number) => void;
  onClose: () => void;
}) {
  const saved = useSaved();
  const groups = savedByRoute(saved, places, routes);
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = currentLang() === 'ar';

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-sand/50 px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink"
            aria-label={L('Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
          <h2 id="saved-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Saved places', 'الأماكن المحفوظة')}</h2>
          <p className="text-sm text-stone-500" aria-live="polite">{countLabel(total)}</p>
        </div>

        {total === 0 ? (
          <p className="flex items-start gap-3 px-5 py-8 text-sm text-stone-600">
            <Bookmark className="w-5 h-5 shrink-0 text-gold" aria-hidden="true" />
            {L('No saved places yet. Tap the bookmark on a place to keep it here.', 'لا توجد أماكن محفوظة بعد. اضغط على علامة الحفظ في أي مكان لتجده هنا.')}
          </p>
        ) : (
          <div className="px-5 py-4 space-y-6">
            {groups.map(({ route, places: items }) => (
              <section key={route.id} aria-labelledby={`saved-${route.id}`}>
                <h3 id={`saved-${route.id}`} className="text-xs font-bold uppercase tracking-widest text-gold-ink mb-2">{nameOf(route)}</h3>
                <ul className="space-y-2">
                  {items.map(place => {
                    const category = categories.find(c => c.id === place.category);
                    return (
                      <li key={place.id} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onClose();
                            onOpen(place.id);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-sand/40 p-2 text-start hover:border-nile/40"
                        >
                          <span aria-hidden="true" className="shrink-0">
                            <PlacePhoto
                              photo={photoForPlace(place)}
                              alt=""
                              sizes="64px"
                              tapToShow={false}
                              className="w-14 h-14 rounded-xl"
                              fallback={<HistoricPlaceholder category={place.category} name={place.nameEn} className="w-14 h-14 rounded-xl" />}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base text-ink" lang={fallbackLang(place, 'name')}>{nameOf(place)}</span>
                            {category && <span className="block truncate text-xs text-stone-500">{nameOf(category)}</span>}
                          </span>
                          <ChevronRight className={`w-4 h-4 shrink-0 text-stone-300 ${ar ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => removeSaved([place.id])}
                          className="flex items-center justify-center min-w-11 min-h-11 rounded-full text-stone-400 hover:text-red-700 hover:bg-red-50"
                          aria-label={`${L('Remove', 'إزالة')}: ${nameOf(place)}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
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
      {open && <SavedSheet places={places} routes={routes} onOpen={onOpen} onClose={() => setOpen(false)} />}
    </>
  );
}
