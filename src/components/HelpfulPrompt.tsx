import React, { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { createIdSetStore } from '../lib/id-set-store';
import { optedOut, track } from '../lib/track';
import { L } from '../i18n/lang';

// Places this device has already voted on: asked once per place.
const voted = createIdSetStore('cw:helpful-voted');

/**
 * "Was this helpful? Yes / No" at the end of a place's card. One tap, sent
 * with the anonymous usage counts (place and vote only), asked once per place
 * on this device. Not shown to visitors who opt out of counting.
 */
export function HelpfulPrompt({ placeId, className = '' }: { placeId: number; className?: string }) {
  const done = voted.useIds().has(placeId);
  const [thanked, setThanked] = useState(false);
  if (optedOut()) return null;
  if (done) {
    return thanked ? (
      <p className={`text-sm text-nile ${className}`} role="status">
        {L('Thanks for your feedback.', 'شكرًا على رأيك.')}
      </p>
    ) : null;
  }
  const vote = (up: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    track({ t: up ? 'up' : 'down', id: placeId });
    voted.add(placeId);
    setThanked(true);
  };
  const button = 'inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-sand bg-white text-sm font-bold text-ink hover:border-nile';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} role="group" aria-labelledby={`helpful-${placeId}`}>
      <span id={`helpful-${placeId}`} className="text-sm text-stone-600">{L('Was this helpful?', 'هل كان هذا مفيدًا؟')}</span>
      <button type="button" onClick={vote(true)} className={button}>
        <ThumbsUp className="w-4 h-4 text-nile" aria-hidden="true" />
        {L('Yes', 'نعم')}
      </button>
      <button type="button" onClick={vote(false)} className={button}>
        <ThumbsDown className="w-4 h-4 text-stone-500" aria-hidden="true" />
        {L('No', 'لا')}
      </button>
    </div>
  );
}
