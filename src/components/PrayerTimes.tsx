import React from 'react';
import { MoonStar } from 'lucide-react';
import type { Location } from '../data/locations';
import { isActiveMosque, prayerOnArrival, prayerStatus, prayerText } from '../lib/prayer-times';
import { byLang, currentLang } from '../i18n/lang';
import { useNow } from './PlaceHours';

/**
 * For an active mosque: "Dhuhr at 12:01 · visits pause for about 30 min" when
 * a prayer is close, or "Prayer time now · visits resume around 12:31" during
 * one. Nothing for other places, or when no prayer is near.
 */
export function PrayerNotice({ place, compact = false, className = '' }: { place: Location; compact?: boolean; className?: string }) {
  const now = useNow();
  if (!isActiveMosque(place)) return null;
  const status = prayerStatus(now);
  // In compact list rows, only a pause happening now is worth the space.
  if (!status || (compact && status.state !== 'now')) return null;
  const { label, detail } = prayerText(status, currentLang());
  const now_ = status.state === 'now';
  return (
    <span className={`${compact ? 'inline' : 'block'} text-xs leading-snug ${className}`}>
      <MoonStar className={`inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle ${now_ ? 'text-amber-700' : 'text-gold'}`} aria-hidden="true" />
      <span className={`font-bold ${now_ ? 'text-amber-800' : 'text-nile'}`}>{label}</span>
      {!compact && <span className="text-stone-500"> · {detail}</span>}
    </span>
  );
}

/**
 * "Prayer time when you get there · visits resume around 12:31", for the next
 * stop when it's an active mosque and the walk would arrive during prayer.
 */
export function PrayerArrivalWarning({ place, minutes, className = '' }: { place: Location; minutes: number; className?: string }) {
  const now = useNow();
  if (!isActiveMosque(place) || !prayerOnArrival(minutes, now)) return null;
  const arrival = new Date(now.getTime() + minutes * 60_000);
  const { detail } = prayerText(prayerStatus(arrival)!, currentLang());
  return (
    <span className={`block text-xs leading-snug text-amber-800 ${className}`}>
      <MoonStar className="inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle" aria-hidden="true" />
      {byLang({
        en: 'Prayer time when you get there',
        ar: 'وقت الصلاة عند وصولك',
        fr: 'Heure de la prière à votre arrivée',
        es: 'Hora de la oración cuando llegues',
      })}
      <span className="text-stone-500"> · {detail}</span>
    </span>
  );
}
