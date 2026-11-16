import React, { useId } from 'react';
import { Camera } from 'lucide-react';
import type { Location } from '../data/locations';
import { photoTipOf } from '../lib/spot-it';
import { L, currentLang } from '../i18n/lang';

/** "Photo tip": where to stand and when for the best photo. Nothing without one. */
export function PhotoTip({ place, className = '' }: { place: Location; className?: string }) {
  // Unique per card: walk mode can show the same place over its card in the list.
  const id = useId();
  const tip = photoTipOf(place, currentLang());
  if (!tip) return null;
  return (
    <section aria-labelledby={id} data-photo-tip={place.id} onClick={e => e.stopPropagation()} className={`rounded-2xl border border-sand bg-chalk/60 p-4 ${className}`}>
      <h4 id={id} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">
        <Camera className="w-4 h-4" aria-hidden="true" />
        {L('Photo tip', 'نصيحة للتصوير')}
      </h4>
      <p className="text-sm text-ink" lang={tip.lang}>{tip.text}</p>
    </section>
  );
}
