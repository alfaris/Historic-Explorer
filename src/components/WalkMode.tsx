import React, { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, BellRing, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Footprints, Flag, LocateFixed, Map as MapIcon, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { photoForPlace } from '../data/photo-resolve';
import { ARRIVE_METERS, distanceMeters, formatDistance, MAX_ACCURACY_METERS } from '../lib/geo';
import { markVisited, useVisited } from '../lib/visited';
import { walkMinutes, walkPlan, walkStops } from '../lib/walk';
import { approachAlert, arrowRotation, bearingDegrees, compassPoint, shouldAutoPlay, startIndex } from '../lib/walk-mode';
import { guidePlayer } from '../lib/guide-player';
import { useDialog } from '../lib/useDialog';
import { useHeading, useWakeLock } from '../lib/useWalkSensors';
import { AudioGuide } from './AudioGuide';
import { BuiltBadge } from './PlaceEra';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { PlacePhoto } from './PlacePhoto';
import type { NearMeState } from './NearMe';

import { L, nameOf, descriptionOf, currentLang, byLang, fallbackLang } from '../i18n/lang';
import { GlossaryText } from './GlossaryText';
import { SaveToggle } from './Saved';
import { HelpfulPrompt } from './HelpfulPrompt';
import { LazyBoundary } from './LazyBoundary';

// Leaflet loads only when the map is first opened.
const WalkMiniMap = lazy(() => import('./WalkMiniMap'));
const MAP_KEY = 'cw:walk-map';
const readMapOpen = () => {
  try {
    return window.localStorage.getItem(MAP_KEY) === '1';
  } catch {
    return false;
  }
};
// "Almost there" alerts: on unless turned off, remembered on the device.
const APPROACH_KEY = 'cw:walk-approach';
const readApproachOn = () => {
  try {
    return window.localStorage.getItem(APPROACH_KEY) !== '0';
  } catch {
    return true;
  }
};
// "Play on arrival": off unless turned on, remembered on the device.
const AUTOPLAY_KEY = 'cw:walk-autoplay';
const readAutoPlayOn = () => {
  try {
    return window.localStorage.getItem(AUTOPLAY_KEY) === '1';
  } catch {
    return false;
  }
};
import { minutesLabel as minutes, stopOfLabel } from './WalkInfo';
import { ArrivalWarning, HoursBadge } from './PlaceHours';
import { PrayerArrivalWarning, PrayerNotice } from './PrayerTimes';
import { VisitorTips } from './VisitorTips';
import { BreakView, TakeABreak } from './TakeABreak';


/**
 * "Start the walk": a full-screen guide through a route's stops. Shows the
 * current stop with its audio guide, and the way to the next one (distance
 * and direction when location is on). Arriving at a stop moves to it, marks
 * it visited and offers its audio guide, which plays by itself only when the
 * visitor turned on "Play the guide when I arrive".
 */
export function WalkMode({ route, places, nearMe, isArabic, onClose, onFinish = onClose }: {
  route: Route;
  places: Location[];
  nearMe: NearMeState;
  isArabic: boolean;
  onClose: () => void;
  /** "Finish the walk" on the last stop: closes the walk and shows its summary. */
  onFinish?: () => void;
}) {
  const ar = isArabic;
  const stops = useMemo(() => walkStops(places, route.id), [places, route.id]);
  const plan = useMemo(() => walkPlan(places, route.id), [places, route.id]);
  const visited = useVisited();
  const [index, setIndex] = useState(() => startIndex(stops.map(s => s.id), visited));
  const [arrivedId, setArrivedId] = useState<number | null>(null);
  // "Take a break": the list (open or not) and the café or toilet stop being looked at.
  const [breaksOpen, setBreaksOpen] = useState(false);
  const [breakPlace, setBreakPlace] = useState<{ place: Location; distance: string } | null>(null);
  const breakToggle = useRef<HTMLDivElement>(null);
  const backFromBreak = () => {
    setBreakPlace(null);
    // Back where the visitor left: the "Take a break" list.
    requestAnimationFrame(() => breakToggle.current?.querySelector('button')?.focus());
  };
  // Escape closes a break place first, then the walk.
  const { ref, guard } = useDialog<HTMLDivElement>(() => (breakPlace ? backFromBreak() : onClose()));
  const heading = useHeading(true);
  useWakeLock(true);
  // The small map: closed by default, remembered on the device.
  const [mapOpen, setMapOpen] = useState(readMapOpen);
  const toggleMap = () =>
    setMapOpen(open => {
      try {
        window.localStorage.setItem(MAP_KEY, open ? '0' : '1');
      } catch {
        // Not remembered; it still opens.
      }
      return !open;
    });

  // "Almost there": once per stop, about 60 m before arriving.
  const [approachOn, setApproachOn] = useState(readApproachOn);
  const [approaching, setApproaching] = useState<Location | null>(null);
  const announced = useRef(new Set<number>());
  const toggleApproach = () =>
    setApproachOn(on => {
      try {
        window.localStorage.setItem(APPROACH_KEY, on ? '0' : '1');
      } catch {
        // Not remembered; it still changes.
      }
      if (on) setApproaching(null);
      return !on;
    });

  // "Play on arrival": the stop whose guide should start by itself (cleared once it starts).
  const [autoPlayOn, setAutoPlayOn] = useState(readAutoPlayOn);
  const [autoPlayFor, setAutoPlayFor] = useState<number | null>(null);
  const autoPlayed = useRef(new Set<number>());
  const toggleAutoPlay = () =>
    setAutoPlayOn(on => {
      try {
        window.localStorage.setItem(AUTOPLAY_KEY, on ? '0' : '1');
      } catch {
        // Not remembered; it still changes.
      }
      return !on;
    });

  // Near me spotted an arrival: if it's one of this walk's stops, move there.
  useEffect(() => {
    const place = nearMe.arrivedPlace;
    if (!place) return;
    const i = stops.findIndex(s => s.id === place.id);
    if (i === -1) return;
    // Checked before moving: moving to another stop stops the guide that was playing.
    if (shouldAutoPlay(autoPlayOn, place.id, autoPlayed.current, guidePlayer().getState().status)) {
      autoPlayed.current.add(place.id);
      setAutoPlayFor(place.id);
    }
    setIndex(i);
    setArrivedId(place.id);
    markVisited(place.id);
    nearMe.dismissArrival();
  }, [nearMe.arrivedPlace, stops, nearMe, autoPlayOn]);

  // Whenever the position or the next stop changes: announce the next stop once, when close.
  const nextStop = stops.length ? plan.get(stops[Math.min(index, stops.length - 1)].id)?.leg?.next ?? null : null;
  const liveFix = nearMe.fix && nearMe.fix.accuracy <= MAX_ACCURACY_METERS * 2 ? nearMe.fix : null;
  useEffect(() => {
    // A new next stop (or none): any banner was for the one before.
    setApproaching(a => (a && a.id === nextStop?.id ? a : null));
    if (!approachOn || !liveFix || !nextStop) return;
    const id = approachAlert(nextStop, distanceMeters(liveFix, nextStop), liveFix.accuracy, announced.current, ARRIVE_METERS);
    if (id === null) return;
    announced.current.add(id);
    setApproaching(nextStop);
    // A gentle buzz for a phone in a pocket (where vibration is supported); never a sound.
    navigator.vibrate?.([120, 80, 120]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFix?.lat, liveFix?.lng, liveFix?.accuracy, nextStop?.id, approachOn]);

  if (stops.length === 0) return null;
  const stop = stops[Math.min(index, stops.length - 1)];
  const info = plan.get(stop.id)!;
  const next = info.leg?.next ?? null;
  const name = (p: Location) => (nameOf(p));
  const fix = nearMe.fix && nearMe.fix.accuracy <= MAX_ACCURACY_METERS * 2 ? nearMe.fix : null;
  const done = stops.filter(s => visited.has(s.id)).length;

  // The way to the next stop: live from the visitor's position when we have
  // one, otherwise the planned walk from this stop.
  let way: React.ReactNode = null;
  if (next) {
    const live = fix ? { meters: distanceMeters(fix, next), bearing: bearingDegrees(fix, next) } : null;
    const meters = live ? live.meters : info.leg!.meters;
    way = (
      <div className="flex items-center gap-4">
        {live && (
          <div className="w-14 h-14 shrink-0 rounded-full bg-nile text-white flex items-center justify-center" aria-hidden="true">
            <ArrowUp className="w-7 h-7 transition-transform" style={{ transform: `rotate(${arrowRotation(live.bearing, heading)}deg)` }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">{L('Next stop', 'المحطة التالية')}</p>
          <p className="text-lg text-ink leading-tight truncate">{name(next)}</p>
          <p className="text-sm text-stone-600">
            {formatDistance(meters, ar)} · {minutes(live ? walkMinutes(live.meters) : info.leg!.minutes)}
            {live && <span className="text-stone-500"> · {heading === null ? compassPoint(live.bearing, currentLang()) : L('follow the arrow', 'اتبع السهم')}</span>}
          </p>
          <ArrivalWarning place={next} minutes={live ? walkMinutes(live.meters) : info.leg!.minutes} className="mt-1" />
          <PrayerArrivalWarning place={next} minutes={live ? walkMinutes(live.meters) : info.leg!.minutes} className="mt-1" />
        </div>
      </div>
    );
  }

  const go = (i: number) => {
    setArrivedId(null);
    setIndex(Math.max(0, Math.min(stops.length - 1, i)));
  };

  return createPortal(
    <div className="fixed inset-0 z-[7000] bg-chalk flex flex-col" role="dialog" aria-modal="true" aria-label={L('Walk', 'الجولة')} dir={ar ? 'rtl' : 'ltr'}>
      <span {...guard('start')} />
      <div ref={ref} data-portal-host className="flex flex-col h-full max-w-2xl w-full mx-auto">
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-ink truncate">{nameOf(route)}</p>
            <p className="text-sm text-stone-600">
              {stopOfLabel(info.number, info.total)} · {byLang({ en: `${done} visited`, ar: `زرت ${done}`, fr: `${done} visitée${done > 1 ? 's' : ''}`, es: `${done} visitada${done === 1 ? '' : 's'}` })}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full bg-white border border-sand/60 text-stone-600 hover:text-ink" aria-label={L('End walk', 'إنهاء الجولة')}>
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="h-1 mx-4 bg-sand/50 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={info.total} aria-valuenow={info.number} aria-label={L('Progress', 'التقدم')}>
          <div className="h-full bg-nile transition-all" style={{ width: `${(info.number / info.total) * 100}%` }} />
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {breakPlace ? (
            <BreakView place={breakPlace.place} distance={breakPlace.distance} isArabic={ar} onBack={backFromBreak} />
          ) : (
          <>
          {approaching && approaching.id === next?.id && (
            <p className="flex items-center gap-2 rounded-2xl bg-gold/15 text-gold-ink px-4 py-3 text-sm font-bold" role="status" aria-live="polite">
              <BellRing className="w-5 h-5 shrink-0" aria-hidden="true" />
              {byLang({
                en: `Almost there: ${name(approaching)}`,
                ar: `اقتربت من ${name(approaching)}`,
                fr: `Presque arrivé : ${name(approaching)}`,
                es: `Casi has llegado: ${name(approaching)}`,
              })}
            </p>
          )}
          {arrivedId === stop.id && (
            <p className="flex items-center gap-2 rounded-2xl bg-nile/10 text-nile px-4 py-3 text-sm font-bold" role="status" aria-live="polite">
              <CircleCheck className="w-5 h-5 shrink-0" />
              {byLang({
                en: `You've arrived at ${name(stop)}. Tap below to hear its audio guide.`,
                ar: `وصلت إلى ${name(stop)}. اضغط للاستماع إلى الدليل الصوتي.`,
                fr: `Vous êtes arrivé à ${name(stop)}. Touchez ci-dessous pour écouter le guide audio.`,
                es: `Has llegado a ${name(stop)}. Toca abajo para escuchar su audioguía.`,
              })}
            </p>
          )}

          <article className="bg-white rounded-3xl border border-sand/50 overflow-hidden">
            <PlacePhoto
              photo={photoForPlace(stop)}
              alt={name(stop)}
              className="w-full h-48"
              sizes="(min-width: 672px) 672px, 100vw"
              priority
              fallback={<HistoricPlaceholder category={stop.category} name={stop.nameEn} className="w-full h-48" />}
            />
            <div className="p-5">
              <h2 className={`text-2xl text-ink leading-tight mb-2 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{name(stop)}</h2>
              <BuiltBadge place={stop} className="mb-2" />
              <HoursBadge place={stop} className="mb-3" />
              <PrayerNotice place={stop} className="mb-3" />
              <p className="text-stone-600 leading-relaxed mb-4" lang={fallbackLang(stop, 'description')}><GlossaryText text={descriptionOf(stop)} /></p>
              <VisitorTips place={stop} className="mb-4" />
              <div className="flex flex-wrap items-center gap-3">
                <AudioGuide
                  locationId={stop.id}
                  text={(descriptionOf(stop)) || ''}
                  langCode={currentLang()}
                  // The lock screen's next button does what "Done here, next stop" does.
                  onNext={next ? () => { markVisited(stop.id); go(index + 1); } : undefined}
                  onPrevious={index > 0 ? () => go(index - 1) : undefined}
                  autoPlay={autoPlayFor === stop.id}
                  onAutoPlayStarted={() => setAutoPlayFor(null)}
                />
                <SaveToggle place={stop} />
                {visited.has(stop.id) ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-nile">
                    <CircleCheck className="w-4 h-4" /> {L('Visited', 'تمت الزيارة')}
                  </span>
                ) : null}
              </div>
              <HelpfulPrompt placeId={stop.id} className="mt-4" />
            </div>
          </article>

          <section className="bg-white rounded-3xl border border-sand/50 p-5" aria-live="polite">
            {next ? (
              way
            ) : (
              <p className="flex items-center gap-2 text-stone-600">
                <Flag className="w-5 h-5 text-gold" /> {L('This is the last stop. Well done!', 'هذه آخر محطة. أحسنت!')}
              </p>
            )}
            {!nearMe.on && next && (
              <button onClick={nearMe.start} className="mt-4 flex items-center gap-2 text-sm text-nile underline underline-offset-4">
                <LocateFixed className="w-4 h-4" />
                {L('Turn on location for distance, direction and arrival alerts', 'شغّل الموقع لمعرفة المسافة والاتجاه والوصول')}
              </button>
            )}
            {nearMe.on && !fix && !nearMe.error && <p className="mt-3 text-xs text-stone-500">{L('Finding your location…', 'جارٍ تحديد موقعك…')}</p>}
            {nearMe.error && <p className="mt-3 text-xs text-red-700">{nearMe.error}</p>}
            {nearMe.on && next && (
              <label className="mt-3 flex items-center gap-2 min-h-11 text-xs text-stone-600 cursor-pointer">
                <input type="checkbox" checked={approachOn} onChange={toggleApproach} className="w-4 h-4 accent-nile" />
                {L('Alert me when the next stop is close (vibrates)', 'نبهني عند الاقتراب من المحطة التالية (اهتزاز)')}
              </label>
            )}
            {nearMe.on && (
              <label className="flex items-center gap-2 min-h-11 text-xs text-stone-600 cursor-pointer">
                <input type="checkbox" checked={autoPlayOn} onChange={toggleAutoPlay} className="w-4 h-4 accent-nile" />
                {L('Play the guide when I arrive', 'شغّل الدليل عند وصولي')}
              </label>
            )}
          </section>

          <section className="bg-white rounded-3xl border border-sand/50 p-3">
            <button
              type="button"
              onClick={toggleMap}
              aria-expanded={mapOpen}
              aria-controls="walk-map"
              className="flex w-full min-h-11 items-center gap-2 px-2 text-sm font-bold text-nile"
            >
              <MapIcon className="w-4 h-4" aria-hidden="true" />
              <span className="flex-1 text-start">{mapOpen ? L('Hide map', 'إخفاء الخريطة') : L('Show map', 'إظهار الخريطة')}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${mapOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {mapOpen && (
              <div id="walk-map" className="mt-2">
                <LazyBoundary
                  loading={<div className="h-52 rounded-2xl bg-chalk animate-pulse" />}
                  failed={<p className="px-2 py-4 text-xs text-stone-500">{L("The map couldn't load. Check your connection.", 'تعذر تحميل الخريطة. تحقق من اتصالك.')}</p>}
                >
                  <WalkMiniMap stops={stops} current={stop} next={next} fix={fix} />
                </LazyBoundary>
              </div>
            )}
          </section>

          <div ref={breakToggle}>
            <TakeABreak
              places={places}
              from={fix ?? stop}
              fromStop={!fix}
              open={breaksOpen}
              onToggle={() => setBreaksOpen(o => !o)}
              onPick={(place, distance) => setBreakPlace({ place, distance })}
              isArabic={ar}
            />
          </div>
          </>
          )}
        </main>

        {!breakPlace && <footer className="grid grid-cols-[auto_1fr] gap-3 px-4 pb-6 pt-2">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="flex items-center justify-center w-14 rounded-2xl bg-white border border-sand/60 text-stone-600 disabled:opacity-40"
            aria-label={L('Previous stop', 'المحطة السابقة')}
          >
            {ar ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          {next ? (
            <button
              onClick={() => {
                markVisited(stop.id);
                go(index + 1);
              }}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-nile text-white font-bold"
            >
              <Footprints className="w-5 h-5" />
              {L('Done here, next stop', 'تمت الزيارة، إلى المحطة التالية')}
            </button>
          ) : (
            <button
              onClick={() => {
                markVisited(stop.id);
                onFinish();
              }}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-nile text-white font-bold"
            >
              <CircleCheck className="w-5 h-5" />
              {L('Finish the walk', 'إنهاء الجولة')}
            </button>
          )}
        </footer>}
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
