import React, { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { createIdSetStore } from '../lib/id-set-store';
import type { Reason } from '../lib/stats';
import { optedOut, track } from '../lib/track';
import { L } from '../i18n/lang';

// Places this device has already voted on: asked once per place.
const voted = createIdSetStore('cw:helpful-voted');

const reasonLabel = (r: Reason) =>
  r === 'outdated' ? L('Information out of date', 'معلومات قديمة')
  : r === 'short' ? L('Too short', 'قصير جدًا')
  : r === 'location' ? L('Hard to find', 'صعب الوصول إليه')
  : r === 'audio' ? L('Audio problem', 'مشكلة في الصوت')
  : L('Something else', 'شيء آخر');
const REASON_ORDER: Reason[] = ['outdated', 'short', 'location', 'audio', 'other'];

/**
 * "Was this helpful? Yes / No" at the end of a place's card. One tap, sent
 * with the anonymous usage counts (place and vote only), asked once per place
 * on this device. After No, an optional reason (one tap, or skip). Not shown
 * to visitors who opt out of counting.
 */
export function HelpfulPrompt({ placeId, className = '' }: { placeId: number; className?: string }) {
  const done = voted.useIds().has(placeId);
  // What this card shows after a vote: thanks, the reasons to pick from, or thanks for the reason.
  const [after, setAfter] = useState<'thanks' | 'why' | 'thanks-why' | 'thanks-other' | null>(null);
  if (optedOut()) return null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (done) {
    if (after === 'why') {
      const pick = (r: Reason) => (e: React.MouseEvent) => {
        stop(e);
        track({ t: 'why', id: placeId, r });
        setAfter(r === 'other' ? 'thanks-other' : 'thanks-why');
      };
      return (
        <div className={`space-y-2 ${className}`} role="group" aria-labelledby={`why-${placeId}`}>
          <p id={`why-${placeId}`} className="text-sm text-stone-600" role="status">
            {L('Thanks. What could be better? (optional)', 'شكرًا. ما الذي يمكن تحسينه؟ (اختياري)')}
          </p>
          <div className="flex flex-wrap gap-2">
            {REASON_ORDER.map(r => (
              <button key={r} type="button" onClick={pick(r)} className="min-h-11 px-3 rounded-full border border-sand bg-white text-xs font-bold text-ink hover:border-nile">
                {reasonLabel(r)}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (!after) return null;
    return (
      <p className={`text-sm text-nile ${className}`} role="status">
        {after === 'thanks-other'
          ? L('Thanks. To tell us more, use Report a problem on the place’s card.', 'شكرًا. لإخبارنا بالمزيد، استخدم «الإبلاغ عن خطأ» في بطاقة المكان.')
          : after === 'thanks-why'
            ? L('Thanks for telling us.', 'شكرًا لإخبارنا.')
            : L('Thanks for your feedback.', 'شكرًا على رأيك.')}
      </p>
    );
  }
  const vote = (up: boolean) => (e: React.MouseEvent) => {
    stop(e);
    track({ t: up ? 'up' : 'down', id: placeId });
    voted.add(placeId);
    setAfter(up ? 'thanks' : 'why');
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
