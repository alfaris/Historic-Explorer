import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ChevronLeft, ChevronRight, CircleCheck, Footprints, Flag, LocateFixed, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { photoForPlace } from '../data/photo-resolve';
import { distanceMeters, formatDistance, MAX_ACCURACY_METERS } from '../lib/geo';
import { markVisited, useVisited } from '../lib/visited';
import { walkMinutes, walkPlan, walkStops } from '../lib/walk';
import { arrowRotation, bearingDegrees, compassPoint, startIndex } from '../lib/walk-mode';
import { useDialog } from '../lib/useDialog';
import { useHeading, useWakeLock } from '../lib/useWalkSensors';
import { AudioGuide } from './AudioGuide';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { PlacePhoto } from './PlacePhoto';
import type { NearMeState } from './NearMe';

const minutes = (n: number, ar: boolean) => (ar ? `${n} ${n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : n <= 10 ? 'دقائق' : 'دقيقة'} سيرًا` : `${n} min walk`);

/**
 * "Start the walk": a full-screen guide through a route's stops. Shows the
 * current stop with its audio guide, and the way to the next one (distance
 * and direction when location is on). Arriving at a stop moves to it, marks
 * it visited and offers its audio guide; audio never plays by itself.
 */
export function WalkMode({ route, places, nearMe, isArabic, onClose }: {
  route: Route;
  places: Location[];
  nearMe: NearMeState;
  isArabic: boolean;
  onClose: () => void;
}) {
  const ar = isArabic;
  const stops = useMemo(() => walkStops(places, route.id), [places, route.id]);
  const plan = useMemo(() => walkPlan(places, route.id), [places, route.id]);
  const visited = useVisited();
  const [index, setIndex] = useState(() => startIndex(stops.map(s => s.id), visited));
  const [arrivedId, setArrivedId] = useState<number | null>(null);
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const heading = useHeading(true);
  useWakeLock(true);

  // Near me spotted an arrival: if it's one of this walk's stops, move there.
  useEffect(() => {
    const place = nearMe.arrivedPlace;
    if (!place) return;
    const i = stops.findIndex(s => s.id === place.id);
    if (i === -1) return;
    setIndex(i);
    setArrivedId(place.id);
    markVisited(place.id);
    nearMe.dismissArrival();
  }, [nearMe.arrivedPlace, stops, nearMe]);

  if (stops.length === 0) return null;
  const stop = stops[Math.min(index, stops.length - 1)];
  const info = plan.get(stop.id)!;
  const next = info.leg?.next ?? null;
  const name = (p: Location) => (ar ? p.nameAr : p.nameEn);
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">{ar ? 'المحطة التالية' : 'Next stop'}</p>
          <p className="text-lg text-ink leading-tight truncate">{name(next)}</p>
          <p className="text-sm text-stone-600">
            {formatDistance(meters, ar)} · {minutes(live ? walkMinutes(live.meters) : info.leg!.minutes, ar)}
            {live && <span className="text-stone-500"> · {heading === null ? compassPoint(live.bearing, ar) : ar ? 'اتبع السهم' : 'follow the arrow'}</span>}
          </p>
        </div>
      </div>
    );
  }

  const go = (i: number) => {
    setArrivedId(null);
    setIndex(Math.max(0, Math.min(stops.length - 1, i)));
  };

  return createPortal(
    <div className="fixed inset-0 z-[7000] bg-chalk flex flex-col" role="dialog" aria-modal="true" aria-label={ar ? 'الجولة' : 'Walk'} dir={ar ? 'rtl' : 'ltr'}>
      <span {...guard('start')} />
      <div ref={ref} className="flex flex-col h-full max-w-2xl w-full mx-auto">
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink truncate">{ar ? route.nameAr : route.nameEn}</p>
            <p className="text-sm text-stone-600">
              {ar ? `المحطة ${info.number} من ${info.total}` : `Stop ${info.number} of ${info.total}`} · {ar ? `زرت ${done}` : `${done} visited`}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full bg-white border border-sand/60 text-stone-600 hover:text-ink" aria-label={ar ? 'إنهاء الجولة' : 'End walk'}>
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="h-1 mx-4 bg-sand/50 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={info.total} aria-valuenow={info.number} aria-label={ar ? 'التقدم' : 'Progress'}>
          <div className="h-full bg-nile transition-all" style={{ width: `${(info.number / info.total) * 100}%` }} />
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {arrivedId === stop.id && (
            <p className="flex items-center gap-2 rounded-2xl bg-nile/10 text-nile px-4 py-3 text-sm font-bold" role="status" aria-live="polite">
              <CircleCheck className="w-5 h-5 shrink-0" />
              {ar ? `وصلت إلى ${name(stop)}. اضغط للاستماع إلى الدليل الصوتي.` : `You've arrived at ${name(stop)}. Tap below to hear its audio guide.`}
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
              <p className="text-stone-600 leading-relaxed mb-4">{ar ? stop.descriptionAr : stop.descriptionEn}</p>
              <div className="flex flex-wrap items-center gap-3">
                <AudioGuide locationId={stop.id} text={(ar ? stop.descriptionAr : stop.descriptionEn) || ''} langCode={ar ? 'ar' : 'en'} />
                {visited.has(stop.id) ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-nile">
                    <CircleCheck className="w-4 h-4" /> {ar ? 'تمت الزيارة' : 'Visited'}
                  </span>
                ) : null}
              </div>
            </div>
          </article>

          <section className="bg-white rounded-3xl border border-sand/50 p-5" aria-live="polite">
            {next ? (
              way
            ) : (
              <p className="flex items-center gap-2 text-stone-600">
                <Flag className="w-5 h-5 text-gold" /> {ar ? 'هذه آخر محطة. أحسنت!' : 'This is the last stop. Well done!'}
              </p>
            )}
            {!nearMe.on && next && (
              <button onClick={nearMe.start} className="mt-4 flex items-center gap-2 text-sm text-nile underline underline-offset-4">
                <LocateFixed className="w-4 h-4" />
                {ar ? 'شغّل الموقع لمعرفة المسافة والاتجاه والوصول' : 'Turn on location for distance, direction and arrival alerts'}
              </button>
            )}
            {nearMe.on && !fix && !nearMe.error && <p className="mt-3 text-xs text-stone-500">{ar ? 'جارٍ تحديد موقعك…' : 'Finding your location…'}</p>}
            {nearMe.error && <p className="mt-3 text-xs text-red-700">{nearMe.error}</p>}
          </section>
        </main>

        <footer className="grid grid-cols-[auto_1fr] gap-3 px-4 pb-6 pt-2">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="flex items-center justify-center w-14 rounded-2xl bg-white border border-sand/60 text-stone-600 disabled:opacity-40"
            aria-label={ar ? 'المحطة السابقة' : 'Previous stop'}
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
              {ar ? 'تمت الزيارة، إلى المحطة التالية' : 'Done here, next stop'}
            </button>
          ) : (
            <button
              onClick={() => {
                markVisited(stop.id);
                onClose();
              }}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-nile text-white font-bold"
            >
              <CircleCheck className="w-5 h-5" />
              {ar ? 'إنهاء الجولة' : 'Finish the walk'}
            </button>
          )}
        </footer>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
