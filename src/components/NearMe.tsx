import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, Navigation, X } from 'lucide-react';
import type { Location } from '../data/locations';
import { formatDistance, MAX_ACCURACY_METERS, nearest, updateArrival, type ArrivalState } from '../lib/geo';
import { AudioGuide } from './AudioGuide';
import { VisitedToggle } from './Visited';

interface NearMeProps {
  places: Location[];
  isArabic: boolean;
  onOpenPlace: (id: number) => void;
}

type Fix = { lat: number; lng: number; accuracy: number };

/**
 * "Near me" mode: while on, watches the visitor's position, shows the nearest
 * place on the current route, and when they arrive at one, offers its audio
 * guide with a Play button. Audio never starts by itself.
 */
export function NearMe({ places, isArabic, onOpenPlace }: NearMeProps) {
  const [on, setOn] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrivedId, setArrivedId] = useState<number | null>(null);
  const arrival = useRef<ArrivalState>({ atId: null });
  const placesRef = useRef(places);
  placesRef.current = places;

  // Watch position only while the mode is on, to save battery.
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
        const result = updateArrival(arrival.current, next, placesRef.current);
        arrival.current = result.state;
        if (result.arrivedId !== null) setArrivedId(result.arrivedId);
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

  // Switching route: forget the place we were at.
  useEffect(() => {
    arrival.current = { atId: null };
    setArrivedId(null);
  }, [places]);

  const stop = () => {
    setOn(false);
    setFix(null);
    setArrivedId(null);
    arrival.current = { atId: null };
  };

  const closest = fix ? nearest(fix, places) : null;
  const arrivedPlace = arrivedId !== null ? places.find(p => p.id === arrivedId) : undefined;
  const name = (p: Location) => (isArabic ? p.nameAr : p.nameEn);

  if (!on) {
    return (
      <button
        onClick={() => setOn(true)}
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-chalk text-nile text-xs font-bold uppercase tracking-widest hover:bg-sand/30 transition-colors"
      >
        <LocateFixed className="w-4 h-4" />
        {isArabic ? 'بالقرب مني' : 'Near me'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={stop}
        aria-pressed="true"
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest hover:bg-nile-light transition-colors"
      >
        <LocateFixed className="w-4 h-4 animate-pulse" />
        {isArabic ? 'إيقاف «بالقرب مني»' : 'Stop near me'}
      </button>

      {/* Floating status: nearest place, or an arrival prompt. */}
      <div
        className="fixed z-[3500] bottom-28 md:bottom-8 inset-x-4 md:inset-x-auto md:end-8 md:w-96 bg-white rounded-3xl shadow-2xl border border-sand/50 p-5"
        dir={isArabic ? 'rtl' : 'ltr'}
        role="status"
        aria-live="polite"
      >
        {arrivedPlace ? (
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold mb-1">
                  {isArabic ? 'لقد وصلت إلى' : "You've arrived at"}
                </p>
                <p className="text-lg text-ink font-serif leading-tight">{name(arrivedPlace)}</p>
              </div>
              <button
                onClick={() => setArrivedId(null)}
                className="p-1 text-stone-400 hover:text-ink"
                aria-label={isArabic ? 'إغلاق' : 'Dismiss'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* The audio guide's own button is the Play button: nothing plays until it's tapped. */}
            <AudioGuide
              locationId={arrivedPlace.id}
              text={(isArabic ? arrivedPlace.descriptionAr : arrivedPlace.descriptionEn) ?? ''}
              langCode={isArabic ? 'ar' : 'en'}
            />
            <div className="flex gap-2 mt-4">
              <VisitedToggle placeId={arrivedPlace.id} isArabic={isArabic} className="py-3 flex-1" />
              <button
                onClick={() => onOpenPlace(arrivedPlace.id)}
                className="flex-1 py-3 rounded-xl bg-ink text-white text-xs font-bold uppercase tracking-widest hover:bg-nile transition-colors"
              >
                {isArabic ? 'التفاصيل' : 'Details'}
              </button>
            </div>
          </div>
        ) : error ? (
          <p className="text-sm text-stone-600">{error}</p>
        ) : !fix ? (
          <p className="text-sm text-stone-500 animate-pulse">{isArabic ? 'جارٍ تحديد موقعك…' : 'Finding your location…'}</p>
        ) : closest ? (
          <button onClick={() => onOpenPlace(closest.place.id)} className="w-full text-start group">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold mb-1">
              {isArabic ? 'الأقرب إليك' : 'Nearest to you'}
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg text-ink font-serif leading-tight group-hover:text-nile">{name(closest.place)}</p>
              <span className="flex items-center gap-1 text-xs font-bold text-nile whitespace-nowrap" dir="ltr">
                <Navigation className="w-3.5 h-3.5" />
                {formatDistance(closest.meters, isArabic)}
              </span>
            </div>
            {fix.accuracy > MAX_ACCURACY_METERS && (
              <p className="text-[11px] text-stone-400 mt-2">
                {isArabic ? 'دقة الموقع منخفضة، قد تتأخر التنبيهات.' : 'Location is approximate; arrival alerts may be delayed.'}
              </p>
            )}
          </button>
        ) : null}
      </div>
    </>
  );
}
