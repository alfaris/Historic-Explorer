import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { ROUTE_REASONS, type RouteReason, type Stars } from '../lib/stats';
import { optedOut, track } from '../lib/track';
import { L } from '../i18n/lang';

// Routes this device has rated: asked once per route.
const RATED_KEY = 'cw:route-rated';
const readRated = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(RATED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const markRated = (routeId: string) => {
  try {
    window.localStorage.setItem(RATED_KEY, JSON.stringify([...new Set([...readRated(), routeId])]));
  } catch {
    // Not remembered: it may be asked again on another visit.
  }
};

const reasonLabel = (r: RouteReason) =>
  r === 'long' ? L('Too long', 'طويلة جدًا')
  : r === 'hot' ? L('Too hot or tiring', 'حارة أو متعبة')
  : r === 'lost' ? L('Hard to follow', 'صعبة التتبع')
  : r === 'closed' ? L('Places were closed', 'أماكن كانت مغلقة')
  : L('Something else', 'شيء آخر');

const starsLabel = (s: Stars) =>
  s === 1 ? L('1 star', 'نجمة واحدة')
  : s === 2 ? L('2 stars', 'نجمتان')
  : s === 3 ? L('3 stars', '3 نجوم')
  : s === 4 ? L('4 stars', '4 نجوم')
  : L('5 stars', '5 نجوم');

/**
 * "How was the walk?" on the finish screen: 1 to 5 stars, then for 1 or 2 an
 * optional reason. Sent with the anonymous usage counts (route and stars
 * only), asked once per route on this device. Not shown to visitors who opt
 * out of counting.
 */
export function RouteRating({ routeId, className = '' }: { routeId: string; className?: string }) {
  const [rated] = useState(() => readRated().includes(routeId));
  const [after, setAfter] = useState<null | 'thanks' | 'why' | 'thanks-why'>(null);
  if (optedOut() || (rated && !after)) return null;

  if (after === 'why') {
    return (
      <div className={`space-y-2 ${className}`} role="group" aria-labelledby="route-why">
        <p id="route-why" className="text-sm text-stone-600" role="status">
          {L('Sorry to hear that. What went wrong? (optional)', 'نأسف لذلك. ما الذي لم يكن جيدًا؟ (اختياري)')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {ROUTE_REASONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => {
                track({ t: 'rwhy', id: routeId, r });
                setAfter('thanks-why');
              }}
              className="min-h-11 px-3 rounded-full border border-sand bg-white text-xs font-bold text-ink hover:border-nile"
            >
              {reasonLabel(r)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (after) {
    return (
      <p className={`text-sm text-nile ${className}`} role="status">
        {after === 'thanks-why' ? L('Thanks for telling us.', 'شكرًا لإخبارنا.') : L('Thanks for your feedback.', 'شكرًا على رأيك.')}
      </p>
    );
  }

  const rate = (s: Stars) => {
    track({ t: 'rate', id: routeId, s });
    markRated(routeId);
    setAfter(s <= 2 ? 'why' : 'thanks');
  };
  return (
    <div className={className} role="group" aria-labelledby="route-rate">
      <p id="route-rate" className="text-sm font-bold text-ink mb-1">{L('How was the walk?', 'كيف كانت الجولة؟')}</p>
      <div className="flex justify-center gap-1">
        {([1, 2, 3, 4, 5] as Stars[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => rate(s)}
            aria-label={starsLabel(s)}
            className="group flex items-center justify-center min-w-11 min-h-11 rounded-full hover:bg-gold/15"
          >
            <Star className="w-7 h-7 text-gold group-hover:fill-gold/60" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
