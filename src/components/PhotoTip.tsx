import React, { useId } from 'react';
import { Camera, Sun } from 'lucide-react';
import type { Location } from '../data/locations';
import { photoTipOf } from '../lib/spot-it';
import { L, currentLang } from '../i18n/lang';
import { goldenHours, goldenText } from '../lib/prayer-times';
import { useNow } from './PlaceHours';

/** "Photo tip": where to stand and when for the best photo. Nothing without one. */
export function PhotoTip({ place, className = '' }: { place: Location; className?: string }) {
  // Unique per card: walk mode can show the same place over its card in the list.
  const id = useId();
  const lang = currentLang();
  const tip = photoTipOf(place, lang);
  // Today's golden hours in Cairo (tomorrow's after sunset), worked out on the phone.
  const now = useNow();
  if (!tip) return null;
  const golden = goldenText(goldenHours(now), lang);
  return (
    <section aria-labelledby={id} data-photo-tip={place.id} onClick={e => e.stopPropagation()} className={`rounded-2xl border border-sand bg-chalk/60 p-4 ${className}`}>
      <h4 id={id} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">
        <Camera className="w-4 h-4" aria-hidden="true" />
        {L('Photo tip', 'نصيحة للتصوير')}
      </h4>
      <p className="text-sm text-ink" lang={tip.lang}>{tip.text}</p>
      <p className="mt-2 flex items-start gap-2 text-xs text-stone-600">
        <Sun className="w-4 h-4 shrink-0 text-gold-ink" aria-hidden="true" />
        <span>{golden}</span>
      </p>
    </section>
  );
}
