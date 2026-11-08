import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Hourglass, Landmark, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { builtLabel, ERAS, isEraId, timeline, yearsText, eraOf, type EraId } from '../lib/eras';
import { useDialog } from '../lib/useDialog';
import { L, currentLang, fallbackLang, nameOf } from '../i18n/lang';

/** "Built 1356–1363 · Mamluk" under a place's name; nothing when it has no date or era. */
export function BuiltBadge({ place, className = '' }: { place: Location; className?: string }) {
  const label = builtLabel(place, currentLang());
  if (!label) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs text-stone-600 ${className}`}>
      <Landmark className="w-3.5 h-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
      {label}
    </p>
  );
}

/** The eras that at least one of `places` belongs to, oldest first. */
export const erasIn = (places: Location[]) => {
  const present = new Set(places.map(eraOf));
  return ERAS.filter(e => present.has(e.id));
};

/** The list's era filter: shown only when some place has an era. */
export function EraFilter({ places, value, onChange }: { places: Location[]; value: EraId | null; onChange: (era: EraId | null) => void }) {
  const eras = useMemo(() => erasIn(places), [places]);
  const lang = currentLang();
  if (eras.length === 0 && !value) return null;
  return (
    <label
      className={`flex items-center gap-1.5 min-h-11 ps-4 pe-2 rounded-full border text-xs font-bold transition-colors ${
        value ? 'bg-nile/10 border-nile text-nile' : 'bg-white border-sand text-stone-600 hover:border-nile/50'
      }`}
    >
      <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="sr-only">{L('Era', 'العصر')}</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(isEraId(e.target.value) ? e.target.value : null)}
        className="bg-transparent min-h-10 pe-1 font-bold focus:outline-none cursor-pointer"
      >
        <option value="">{L('All eras', 'كل العصور')}</option>
        {eras.map(e => (
          <option key={e.id} value={e.id}>{e.names[lang]}</option>
        ))}
      </select>
    </label>
  );
}

function AgesSheet({ places, routes, onOpen, onClose }: {
  places: Location[];
  routes: Route[];
  onOpen: (id: number) => void;
  onClose: () => void;
}) {
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const lang = currentLang();
  const ar = lang === 'ar';
  const groups = useMemo(() => timeline(places, p => nameOf(p)), [places]);
  const routeName = new Map(routes.map(r => [r.id, nameOf(r)]));

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ages-title"
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
          <h2 id="ages-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Through the ages', 'عبر العصور')}</h2>
          <p className="text-sm text-stone-500">{L('Places on every route, from the oldest.', 'أماكن كل المسارات، من الأقدم.')}</p>
        </div>
        <ol className="px-5 py-4 space-y-6">
          {groups.map(({ era, places: items }) => (
            <li key={era.id}>
              <section aria-labelledby={`era-${era.id}`}>
                <h3 id={`era-${era.id}`} className="text-xs font-bold uppercase tracking-widest text-gold-ink mb-2">{era.names[lang]}</h3>
                <ol className="relative border-s-2 border-sand/70 ms-1.5 space-y-1">
                  {items.map(place => (
                    <li key={place.id} className="relative ps-4">
                      <span className="absolute -start-[7px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gold" aria-hidden="true" />
                      <button
                        onClick={() => {
                          onClose();
                          onOpen(place.id);
                        }}
                        className="flex w-full min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-chalk"
                      >
                        <span className="w-20 shrink-0 text-sm tabular-nums text-stone-600">{yearsText(place) ?? '—'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-ink" lang={fallbackLang(place, 'name')}>{nameOf(place)}</span>
                          <span className="block truncate text-xs text-stone-500">{routeName.get(place.routeId)}</span>
                        </span>
                        <ChevronRight className={`w-4 h-4 shrink-0 text-stone-300 ${ar ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </li>
          ))}
        </ol>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}

/** "Through the ages": every dated place across routes, by era. Hidden until some place has a date or era. */
export function ThroughTheAgesButton({ places, routes, onOpen }: { places: Location[]; routes: Route[]; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const dated = useMemo(() => places.some(p => eraOf(p)), [places]);
  if (!dated) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 min-h-11 px-1 text-xs font-bold text-nile"
      >
        <Hourglass className="w-4 h-4" aria-hidden="true" />
        {L('Through the ages', 'عبر العصور')}
      </button>
      {open && <AgesSheet places={places} routes={routes} onOpen={onOpen} onClose={() => setOpen(false)} />}
    </>
  );
}
