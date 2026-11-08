import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Coffee, Toilet, Utensils } from 'lucide-react';
import type { Location } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { photoForPlace, photoAltOf } from '../data/photo-resolve';
import { nearestBreaks, type BreakPlace } from '../lib/breaks';
import { formatDistance, type Point } from '../lib/geo';
import { L, descriptionOf, fallbackLang, nameOf } from '../i18n/lang';
import { GlossaryText } from './GlossaryText';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { HoursBadge, useNow } from './PlaceHours';
import { PlacePhoto } from './PlacePhoto';
import { VisitorTips } from './VisitorTips';
import { minutesLabel } from './WalkInfo';

// Within about 30 m (e.g. the stop the visitor is at) it's simply "here".
const away = (b: BreakPlace<Location>, ar: boolean) => (b.meters < 30 ? L('Here', 'هنا') : `${formatDistance(b.meters, ar)} · ${minutesLabel(b.minutes)}`);

/**
 * Walk mode's "Take a break": the nearest cafés and restaurants and the
 * nearest place with toilets (any route), from the visitor or, without a
 * location, from the current stop. Open ones come first.
 */
export function TakeABreak({ places, from, fromStop, open, onToggle, onPick, isArabic }: {
  places: Location[];
  from: Point;
  /** Distances are from the current stop (no location fix). */
  fromStop: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (place: Location, distance: string) => void;
  isArabic: boolean;
}) {
  const now = useNow();
  const { specialPeriods } = useContent();
  const { food, toilets } = useMemo(() => nearestBreaks(places, from, now, specialPeriods), [places, from.lat, from.lng, now, specialPeriods]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: { b: BreakPlace<Location>; icon: React.ReactNode; label?: string }[] = [
    ...food.map(b => ({ b, icon: b.place.category === 'coffee' ? <Coffee className="w-4 h-4" /> : <Utensils className="w-4 h-4" /> })),
    ...(toilets ? [{ b: toilets, icon: <Toilet className="w-4 h-4" />, label: L('Toilets', 'دورات مياه') }] : []),
  ];

  return (
    <section className="bg-white rounded-3xl border border-sand/50 p-3">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="walk-breaks" className="flex w-full min-h-11 items-center gap-2 px-2 text-sm font-bold text-nile">
        <Coffee className="w-4 h-4" aria-hidden="true" />
        <span className="flex-1 text-start">{L('Take a break', 'استراحة')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="walk-breaks" className="mt-1 px-2 pb-1">
          <p className="text-xs text-stone-500 mb-2">
            {fromStop ? L('Distances from this stop.', 'المسافات من هذه المحطة.') : L('Distances from where you are.', 'المسافات من موقعك.')}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-stone-600 py-2">{L('No cafés, restaurants or toilets listed nearby.', 'لا توجد مقاهٍ أو مطاعم أو دورات مياه مسجلة بالقرب.')}</p>
          ) : (
            <ul className="divide-y divide-sand/40">
              {rows.map(({ b, icon, label }) => (
                <li key={`${label ?? 'food'}-${b.place.id}`}>
                  <button type="button" onClick={() => onPick(b.place, away(b, isArabic))} className="flex w-full min-h-14 items-center gap-3 py-2 text-start">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-chalk text-gold-ink flex items-center justify-center" aria-hidden="true">{icon}</span>
                    <span className="min-w-0 flex-1">
                      {label && <span className="block text-xs font-bold uppercase tracking-wider text-stone-500">{label}</span>}
                      <span className="block text-sm text-ink truncate">{nameOf(b.place)}</span>
                      <span className="block text-xs text-stone-600">{away(b, isArabic)}</span>
                      <HoursBadge place={b.place} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** A café, restaurant or toilet stop opened from "Take a break", with the way back to the walk. */
export function BreakView({ place, distance, isArabic, onBack }: { place: Location; distance: string; isArabic: boolean; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), [place.id]);
  return (
    <div className="space-y-4">
      <button ref={back} type="button" onClick={onBack} className="flex w-full items-center justify-center gap-2 min-h-12 rounded-2xl bg-nile text-white font-bold">
        {L('Back to the walk', 'العودة إلى الجولة')}
      </button>
      <article className="bg-white rounded-3xl border border-sand/50 overflow-hidden">
        <PlacePhoto
          photo={photoForPlace(place)}
          alt={photoAltOf(place)}
          className="w-full h-40"
          sizes="(min-width: 672px) 672px, 100vw"
          fallback={<HistoricPlaceholder category={place.category} name={place.nameEn} className="w-full h-40" />}
        />
        <div className="p-5">
          <h2 className={`text-2xl text-ink leading-tight mb-1 ${isArabic ? 'font-arabic font-bold' : 'font-serif'}`}>{nameOf(place)}</h2>
          <p className="text-sm text-stone-600 mb-2">{distance}</p>
          <HoursBadge place={place} className="mb-3" />
          {descriptionOf(place) && (
            <p className="text-stone-600 leading-relaxed mb-4" lang={fallbackLang(place, 'description')}><GlossaryText text={descriptionOf(place)} /></p>
          )}
          <VisitorTips place={place} />
        </div>
      </article>
    </div>
  );
}
