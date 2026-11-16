import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GalleryPhoto, Location } from '../data/locations';
import { PlacePhoto } from './PlacePhoto';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { L, LANGUAGES, byLang, currentLang, nameOf } from '../i18n/lang';

/** What an extra photo shows, in the visitor's language, or the place's name and its number. */
const altOf = (g: GalleryPhoto, place: Location, n: number) =>
  g[`photoAlt${LANGUAGES[currentLang()].suffix}` as 'photoAltEn']?.trim() || g.photoAltEn?.trim() || `${nameOf(place)} (${n})`;

/**
 * "More photos": a place's extra photos in a row to swipe through, with
 * previous and next buttons and the arrow keys. Each photo is a PlacePhoto, so
 * the data saver shows a placeholder until it's tapped. Loaded only for places
 * that have extra photos (see PlaceDetails).
 */
export default function PlaceGallery({ place }: { place: Location }) {
  const photos = place.gallery ?? [];
  const row = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const ar = currentLang() === 'ar';
  if (photos.length === 0) return null;

  const go = (i: number) => {
    const el = row.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };
  // The photo most in view, for the counter and the buttons.
  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const width = (el.children[0] as HTMLElement | undefined)?.offsetWidth || el.clientWidth;
    setAt(Math.min(photos.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / width))));
  };
  const prev = () => go(Math.max(0, at - 1));
  const next = () => go(Math.min(photos.length - 1, at + 1));
  const button = 'flex items-center justify-center min-w-11 min-h-11 rounded-full border border-sand bg-white text-stone-600 hover:border-nile disabled:opacity-40';

  return (
    <section aria-label={L('More photos', 'صور أخرى')} className="mb-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="flex-1 text-xs font-bold uppercase tracking-widest text-stone-500">{L('More photos', 'صور أخرى')}</h4>
        <span className="text-xs text-stone-500 tabular-nums" aria-live="polite">
          {byLang({ en: `${at + 1} of ${photos.length}`, ar: `${at + 1} من ${photos.length}`, fr: `${at + 1} sur ${photos.length}`, es: `${at + 1} de ${photos.length}` })}
        </span>
        <button type="button" onClick={prev} disabled={at === 0} className={button} aria-label={L('Previous photo', 'الصورة السابقة')}>
          {ar ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={next} disabled={at === photos.length - 1} className={button} aria-label={L('Next photo', 'الصورة التالية')}>
          {ar ? <ChevronLeft className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      <div
        ref={row}
        onScroll={onScroll}
        tabIndex={0}
        role="group"
        aria-label={L('More photos', 'صور أخرى')}
        onKeyDown={e => {
          // Arrow keys move in reading direction (right to left in Arabic).
          if (e.key === 'ArrowRight') { e.preventDefault(); (ar ? prev : next)(); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); (ar ? next : prev)(); }
        }}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-nile/40 [scrollbar-width:none]"
      >
        {photos.map((g, i) => (
          <div key={g.src} className="snap-start shrink-0 w-full">
            <PlacePhoto
              photo={g}
              alt={altOf(g, place, i + 2)}
              showCredit
              sizes="(min-width: 640px) 600px, 100vw"
              className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-chalk"
              fallback={<HistoricPlaceholder category={place.category} name={place.nameEn} className="w-full h-full" />}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
