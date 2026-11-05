// Sends anonymous usage counts (see stats.ts). Each audio guide, route and
// Near me arrival counts once per visit, events are sent together in one
// small request (when the page is hidden or closed, or after a short wait),
// and nothing about the visitor is sent. Visitors who ask not to be tracked
// (Global Privacy Control or Do Not Track) send nothing.

import type { StatEvent } from './stats';

const ENDPOINT = '/api/stats';
const SEND_AFTER_MS = 30_000;

const optedOut = () => {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { globalPrivacyControl?: boolean });
  return !nav || nav.globalPrivacyControl === true || nav.doNotTrack === '1';
};

let queue: StatEvent[] = [];
const seen = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

/** Sends what's queued. Uses sendBeacon so it still goes out as the page closes. */
export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (queue.length === 0) return;
  const body = JSON.stringify({ events: queue });
  queue = [];
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    // Fall through to fetch.
  }
  fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

const listen = () => {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
};

/** Counts an event, once per visit. */
export function track(event: StatEvent) {
  if (optedOut()) return;
  const key = `${event.t}:${event.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  queue.push(event);
  listen();
  timer ??= setTimeout(flush, SEND_AFTER_MS);
}

/** For tests. */
export const resetTrackingForTest = () => {
  queue = [];
  seen.clear();
  if (timer) clearTimeout(timer);
  timer = null;
};
