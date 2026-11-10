import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { placeShareUrl, routeShareUrl } from '../lib/share';

import { L, currentLang, nameOf } from '../i18n/lang';

/**
 * Opens the phone's share sheet where there is one, otherwise copies the link.
 * Returns whether the link was copied (to show "Link copied").
 */
export async function shareLink(url: string, title: string, text: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return false;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false; // The visitor closed the sheet.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt(L('Copy the link:', 'انسخ الرابط:'), url);
    return false;
  }
}

export function useCopied() {
  const [copied, setCopied] = useState(false);
  const flash = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return [copied, flash] as const;
}

/**
 * "Share route": a link that opens the app on this route, with a preview card.
 * `compactOnPhone`: an icon-only square on phones (the label stays the
 * button's accessible name), so it fits beside "Start the walk".
 */
export function ShareRoute({ route, short = false, compactOnPhone = false }: {
  route: Route;
  isArabic?: boolean;
  /** The short walk is on: the link opens it, and the text says so. */
  short?: boolean;
  compactOnPhone?: boolean;
}) {
  const [copied, flash] = useCopied();
  const share = async () => {
    const what = short ? L('Short walk', 'جولة قصيرة') : L('a walk through historic Cairo', 'جولة سير في القاهرة التاريخية');
    const text = `${nameOf(route)}: ${what}`;
    if (await shareLink(routeShareUrl(window.location.origin, route.id, short), nameOf(route), text)) flash();
  };
  return (
    <button
      onClick={share}
      className={`flex items-center justify-center gap-2 min-h-12 py-3.5 rounded-2xl bg-white border border-sand text-ink text-xs font-bold uppercase tracking-widest shadow-sm hover:border-nile transition-colors ${compactOnPhone ? 'min-w-12 px-3.5 sm:px-5' : 'px-5'}`}
    >
      {copied ? <Check className="w-4 h-4 text-nile" /> : <Share2 className="w-4 h-4 text-stone-500" />}
      <span aria-live="polite" className={compactOnPhone ? 'sr-only sm:not-sr-only' : undefined}>{copied ? (L('Link copied', 'تم نسخ الرابط')) : L('Share route', 'مشاركة المسار')}</span>
    </button>
  );
}

/**
 * Share a place: a `/p/<id>` link (in the current language) that opens the
 * app on this place, with its photo, name and description as the preview.
 */
export function SharePlace({ place, className = '' }: { place: Location; className?: string }) {
  const [copied, flash] = useCopied();
  const share = async (e: React.MouseEvent) => {
    e.stopPropagation(); // The card behind it opens and closes on click.
    const text = `${nameOf(place)}: ${L('a walk through historic Cairo', 'جولة سير في القاهرة التاريخية')}`;
    if (await shareLink(placeShareUrl(window.location.origin, place.id, currentLang()), nameOf(place), text)) flash();
  };
  return (
    <button onClick={share} className={className} aria-label={copied ? L('Link copied', 'تم نسخ الرابط') : L('Share this place', 'مشاركة هذا المكان')}>
      {copied ? <Check className="w-5 h-5 text-nile" /> : <Share2 className="w-5 h-5" />}
      <span className="sr-only" aria-live="polite">{copied ? L('Link copied', 'تم نسخ الرابط') : ''}</span>
    </button>
  );
}
