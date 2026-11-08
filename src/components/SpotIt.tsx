import React, { useState } from 'react';
import { Binoculars, Check } from 'lucide-react';
import type { Location } from '../data/locations';
import { spotOf, spotted } from '../lib/spot-it';
import { L, currentLang } from '../i18n/lang';

/**
 * "Spot it": the stop's find-this challenge for children, with "Found it!"
 * (kept on the device) and the answer behind a tap. Nothing without a
 * challenge.
 */
export function SpotIt({ place, className = '' }: { place: Location; className?: string }) {
  const found = spotted.useIds().has(place.id);
  const [shownFor, setShownFor] = useState<number | null>(null);
  const spot = spotOf(place, currentLang());
  if (!spot) return null;
  const answerShown = shownFor === place.id;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <section
      onClick={stop}
      aria-labelledby={`spot-${place.id}`}
      className={`rounded-2xl border p-4 ${found ? 'border-nile/40 bg-nile/5' : 'border-gold/40 bg-gold/10'} ${className}`}
    >
      <h4 id={`spot-${place.id}`} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-ink mb-1">
        <Binoculars className="w-4 h-4" aria-hidden="true" />
        {L('Spot it', 'ابحث عنه')}
      </h4>
      <p className="text-sm text-ink" lang={spot.question.lang}>{spot.question.text}</p>
      {spot.answer && answerShown && (
        <p className="mt-1 text-sm text-stone-600" lang={spot.answer.lang} role="status">
          {spot.answer.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => (found ? spotted.remove([place.id]) : spotted.add(place.id))}
          aria-pressed={found}
          className={`inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-xs font-bold ${
            found ? 'bg-nile text-white' : 'bg-white border border-sand text-ink hover:border-nile'
          }`}
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          {found ? L('Found!', 'وجدته!') : L('Found it!', 'وجدته')}
        </button>
        {spot.answer && !answerShown && (
          <button
            type="button"
            onClick={() => setShownFor(place.id)}
            className="min-h-11 px-3 text-xs font-bold text-nile underline underline-offset-4 hover:no-underline"
          >
            {L('Show the answer', 'اعرض الإجابة')}
          </button>
        )}
      </div>
    </section>
  );
}
