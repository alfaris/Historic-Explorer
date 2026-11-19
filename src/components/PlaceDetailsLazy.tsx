import React, { lazy } from 'react';
import { L } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';

const load = () => import('./PlaceDetails');
const PlaceDetails = lazy(load);

/** Starts loading the card body early (a place link), so it's there when the card opens. */
export const preloadPlaceDetails = () => {
  load().catch(() => {});
};

// Otherwise it loads once the page is idle after first paint, so a card the
// visitor opens later doesn't wait for it either.
if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2_000));
  if (document.readyState === 'complete') idle(preloadPlaceDetails);
  else window.addEventListener('load', () => idle(preloadPlaceDetails), { once: true });
}

/**
 * A place card's body, loaded the first time a card opens (it's most of a
 * card's code and only needed then). The placeholder keeps some height, so the
 * card's opening animation doesn't jump; offline, the service worker has it.
 */
export function PlaceDetailsLazy(props: React.ComponentProps<typeof PlaceDetails>) {
  return (
    <LazyBoundary
      loading={<div className="min-h-64" aria-busy="true" />}
      failed={<p className="text-sm text-stone-500 mb-6">{L("This place's details couldn't load. Check your connection and open it again.", 'تعذر تحميل تفاصيل هذا المكان. تحقق من الاتصال وافتحه مرة أخرى.')}</p>}
    >
      <PlaceDetails {...props} />
    </LazyBoundary>
  );
}
