import { useEffect, useState } from 'react';

/**
 * Keeps the screen on while `active`, using the Screen Wake Lock API where
 * the browser has it. The lock is dropped by the browser when the page is
 * hidden, so it's taken again when the page comes back.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!active || !nav.wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const take = () => {
      nav.wakeLock!.request('screen').then(
        l => {
          if (cancelled) l.release().catch(() => {});
          else lock = l;
        },
        () => {}, // Refused (battery saver, unsupported): the walk works without it.
      );
    };
    const onVisible = () => document.visibilityState === 'visible' && take();
    take();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS only lets a page read the compass after asking, from a tap. Call this
 * from the tap that starts the walk. Elsewhere it does nothing.
 */
export async function askForCompass(): Promise<void> {
  const ctor = (window as unknown as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
  try {
    await ctor?.requestPermission?.();
  } catch {
    // Declined or unavailable: the arrow points north-up instead.
  }
}

/** Which way the phone faces, in degrees from north, or null without a compass. */
export function useHeading(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const onOrientation = (e: Event) => {
      const o = e as OrientationEventWithCompass;
      if (typeof o.webkitCompassHeading === 'number') setHeading(o.webkitCompassHeading); // iOS
      else if (o.absolute && typeof o.alpha === 'number') setHeading((360 - o.alpha) % 360); // Android
    };
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation);
      window.removeEventListener('deviceorientation', onOrientation);
      setHeading(null);
    };
  }, [active]);
  return heading;
}
