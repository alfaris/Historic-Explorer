import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import type { Route } from '../data/locations';
import { routeShareUrl } from '../lib/share';

import { L, nameOf } from '../i18n/lang';
/**
 * "Share route": the phone's share sheet where there is one, otherwise copies
 * a link that opens the app on this route.
 */
export function ShareRoute({ route, isArabic }: { route: Route; isArabic: boolean }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = routeShareUrl(window.location.origin, route.id);
    const title = nameOf(route);
    const text = `${nameOf(route)}: ${L('a walk through historic Cairo', 'جولة سير في القاهرة التاريخية')}`;
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
      window.prompt(L('Copy the link:', 'انسخ الرابط:'), url);
    }
  };
  return (
    <button
      onClick={share}
      className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white border border-sand text-ink text-xs font-bold uppercase tracking-widest shadow-sm hover:border-nile transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-nile" /> : <Share2 className="w-4 h-4 text-stone-500" />}
      <span aria-live="polite">{copied ? (L('Link copied', 'تم نسخ الرابط')) : L('Share route', 'مشاركة المسار')}</span>
    </button>
  );
}
