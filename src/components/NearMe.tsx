import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, LocateFixed, Navigation, X } from 'lucide-react';
import { categories, type Location } from '../data/locations';
import { track } from '../lib/track';
import { distanceMeters, formatDistance, MAX_ACCURACY_METERS, updateArrival, type ArrivalState } from '../lib/geo';
import { useVisited } from '../lib/visited';
import { AudioGuide } from './AudioGuide';
import { VisitedToggle } from './Visited';

type Fix = { lat: number; lng: number; accuracy: number };

export interface NearMeState {
  on: boolean;
  fix: Fix | null;
  error: string | null;
  arrivedPlace: Location | null;
  start: () => void;
  stop: () => void;
  dismissArrival: () => void;
}

/**
 * Watches the visitor's position while "Near me" is on, wherever they are in
 * the app, and detects arriving at any place. Lives in MainContent so it
 * keeps running when the visitor switches between the List, Map and Near me
 * tabs; only stop() ends it.
 */
export function useNearMe(isArabic: boolean, places: Location[]): NearMeState {
  const [on, setOn] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrivedId, setArrivedId] = useState<number | null>(null);
  const arrival = useRef<ArrivalState>({ atId: null });
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    if (!on) return;
    if (!('geolocation' in navigator)) {
      setError(isArabic ? 'تحديد الموقع غير مدعوم في هذا المتصفح.' : "This browser can't share your location.");
      return;
    }
    setError(null);
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setFix(next);
        setError(null);
        // Arrival counts for any place, whichever route is selected.
        const result = updateArrival(arrival.current, next, placesRef.current);
        arrival.current = result.state;
        if (result.arrivedId !== null) {
          setArrivedId(result.arrivedId);
          track({ t: 'arrive', id: result.arrivedId });
        }
      },
      err => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? isArabic
              ? 'اسمح بالوصول إلى موقعك لاستخدام هذه الميزة.'
              : 'Allow location access to use Near me.'
            : isArabic
              ? 'تعذر تحديد موقعك الآن.'
              : "Couldn't get your location right now.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [on, isArabic]);

  const start = useCallback(() => setOn(true), []);
  const stop = useCallback(() => {
    setOn(false);
    setFix(null);
    setError(null);
    setArrivedId(null);
    arrival.current = { atId: null };
  }, []);
  const dismissArrival = useCallback(() => setArrivedId(null), []);

  const arrivedPlace = arrivedId !== null ? places.find(l => l.id === arrivedId) ?? null : null;
  return { on, fix, error, arrivedPlace, start, stop, dismissArrival };
}

const placeName = (p: Location, isArabic: boolean) => (isArabic ? p.nameAr : p.nameEn);

/** "You've arrived at …" with the audio guide's Play button. Audio never starts by itself. */
function ArrivalCard({ place, isArabic, onDismiss, onOpenPlace }: {
  place: Location;
  isArabic: boolean;
  onDismiss: () => void;
  onOpenPlace: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink mb-1">
            {isArabic ? 'لقد وصلت إلى' : "You've arrived at"}
          </p>
          <p className="text-lg text-ink font-serif leading-tight">{placeName(place, isArabic)}</p>
        </div>
        <button onClick={onDismiss} className="p-1 text-stone-400 hover:text-ink" aria-label={isArabic ? 'إغلاق' : 'Dismiss'}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <AudioGuide
        locationId={place.id}
        text={(isArabic ? place.descriptionAr : place.descriptionEn) ?? ''}
        langCode={isArabic ? 'ar' : 'en'}
      />
      <div className="flex gap-2 mt-4">
        <VisitedToggle placeId={place.id} isArabic={isArabic} className="py-3 flex-1" />
        <button
          onClick={() => onOpenPlace(place.id)}
          className="flex-1 py-3 rounded-xl bg-ink text-white text-xs font-bold uppercase tracking-widest hover:bg-nile transition-colors"
        >
          {isArabic ? 'التفاصيل' : 'Details'}
        </button>
      </div>
    </div>
  );
}

/**
 * Shown over the List and Map tabs while Near me is on: the arrival prompt
 * when there is one, otherwise a small "Near me on · Stop" pill.
 */
export function NearMeOverlay({ nearMe, isArabic, onOpenPlace, onShowTab }: {
  nearMe: NearMeState;
  isArabic: boolean;
  onOpenPlace: (id: number) => void;
  onShowTab: () => void;
}) {
  if (!nearMe.on) return null;
  const position = 'fixed z-[3500] bottom-28 md:bottom-8 inset-x-4 md:inset-x-auto md:end-8';

  if (nearMe.arrivedPlace) {
    return (
      <div className={`${position} md:w-96 bg-white rounded-3xl shadow-2xl border border-sand/50 p-5`} dir={isArabic ? 'rtl' : 'ltr'} role="status" aria-live="polite">
        <ArrivalCard place={nearMe.arrivedPlace} isArabic={isArabic} onDismiss={nearMe.dismissArrival} onOpenPlace={onOpenPlace} />
      </div>
    );
  }

  return (
    <div className={`${position} flex justify-center md:justify-end pointer-events-none`} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="pointer-events-auto flex items-center gap-1 bg-nile text-white rounded-full shadow-xl ps-4 pe-1 py-1">
        <button onClick={onShowTab} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest py-1.5">
          <LocateFixed className="w-3.5 h-3.5 animate-pulse" />
          {isArabic ? '«بالقرب مني» يعمل' : 'Near me on'}
        </button>
        <button
          onClick={nearMe.stop}
          className="ms-2 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-bold uppercase tracking-widest"
        >
          {isArabic ? 'إيقاف' : 'Stop'}
        </button>
      </div>
    </div>
  );
}

/** The Near me tab: places sorted by distance, with the arrival card on top. */
export function NearMeView({ nearMe, routePlaces, allPlaces, routeName, isArabic, onOpenPlace }: {
  nearMe: NearMeState;
  routePlaces: Location[];
  allPlaces: Location[];
  routeName: string;
  isArabic: boolean;
  onOpenPlace: (id: number) => void;
}) {
  const [scope, setScope] = useState<'route' | 'all'>('route');
  const visited = useVisited();
  const { start, on, fix, error, arrivedPlace } = nearMe;

  // Opening the tab turns Near me on.
  useEffect(() => {
    start();
  }, [start]);

  const sorted = useMemo(() => {
    if (!fix) return [];
    const pool = scope === 'route' ? routePlaces : allPlaces;
    return pool
      .map(place => ({ place, meters: distanceMeters(fix, place) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, scope === 'route' ? undefined : 20);
  }, [fix, scope, routePlaces, allPlaces]);

  return (
    <div className="mb-8 space-y-6" dir={isArabic ? 'rtl' : 'ltr'}>
      {arrivedPlace && (
        <div className="bg-white rounded-3xl shadow-xl border border-gold/40 p-6" role="status" aria-live="polite">
          <ArrivalCard place={arrivedPlace} isArabic={isArabic} onDismiss={nearMe.dismissArrival} onOpenPlace={onOpenPlace} />
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl border border-sand/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex p-1 bg-chalk rounded-xl" role="group" aria-label={isArabic ? 'نطاق البحث' : 'Which places'}>
            {(['route', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  scope === s ? 'bg-white text-nile shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {s === 'route' ? routeName : isArabic ? 'كل المسارات' : 'All routes'}
              </button>
            ))}
          </div>
          {on && (
            <button onClick={nearMe.stop} className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-nile">
              {isArabic ? 'إيقاف تحديد الموقع' : 'Stop location'}
            </button>
          )}
        </div>

        {!on ? (
          <button
            onClick={start}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-nile text-white text-xs font-bold uppercase tracking-widest"
          >
            <LocateFixed className="w-4 h-4" />
            {isArabic ? 'ابدأ «بالقرب مني»' : 'Start Near me'}
          </button>
        ) : error ? (
          <p className="text-sm text-stone-600 py-4">{error}</p>
        ) : !fix ? (
          <p className="text-sm text-stone-500 animate-pulse py-4">{isArabic ? 'جارٍ تحديد موقعك…' : 'Finding your location…'}</p>
        ) : (
          <>
            {fix.accuracy > MAX_ACCURACY_METERS && (
              <p className="text-[11px] text-stone-400 mb-3">
                {isArabic ? 'دقة الموقع منخفضة، قد تتأخر التنبيهات.' : 'Location is approximate; arrival alerts may be delayed.'}
              </p>
            )}
            <ol className="divide-y divide-sand/30">
              {sorted.map(({ place, meters }, i) => {
                const category = categories.find(c => c.id === place.category);
                return (
                  <li key={place.id}>
                    <button onClick={() => onOpenPlace(place.id)} className="w-full flex items-center gap-4 py-3 text-start group">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${category?.color ?? 'bg-nile'}`} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className={`block font-serif leading-tight group-hover:text-nile ${i === 0 ? 'text-lg text-ink' : 'text-base text-stone-700'}`}>
                          {placeName(place, isArabic)}
                        </span>
                        <span className="block text-[10px] uppercase tracking-[0.2em] text-stone-400 mt-0.5">
                          {isArabic ? category?.nameAr : category?.nameEn}
                        </span>
                      </span>
                      {visited.has(place.id) && <CircleCheck className="w-4 h-4 text-nile shrink-0" aria-label={isArabic ? 'تمت الزيارة' : 'Visited'} />}
                      <span className="flex items-center gap-1 text-xs font-bold text-nile whitespace-nowrap" dir="ltr">
                        <Navigation className="w-3.5 h-3.5" />
                        {formatDistance(meters, isArabic)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
