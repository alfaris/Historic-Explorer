import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import type { Route } from '../data/locations';
import { routeShareUrl } from '../lib/share';

/**
 * "Share route": the phone's share sheet where there is one, otherwise copies
 * a link that opens the app on this route.
 */
export function ShareRoute({ route, isArabic }: { route: Route; isArabic: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = routeShareUrl(window.location.origin, route.id);
    const title = isArabic ? route.nameAr : route.nameEn;
    const text = isArabic ? `${route.nameAr}: جولة سير في القاهرة التاريخية` : `${route.nameEn}: a walk through historic Cairo`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // The visitor closed the sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(isArabic ? 'انسخ الرابط:' : 'Copy the link:', url);
    }
  };
  return (
    <button
      onClick={share}
      className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white border border-sand text-ink text-xs font-bold uppercase tracking-widest shadow-sm hover:border-nile transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-nile" /> : <Share2 className="w-4 h-4 text-stone-500" />}
      <span aria-live="polite">{copied ? (isArabic ? 'تم نسخ الرابط' : 'Link copied') : isArabic ? 'مشاركة المسار' : 'Share route'}</span>
    </button>
  );
}
