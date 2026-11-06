// Sends anonymous usage counts (see stats.ts). Each audio guide, route and
// Near me arrival counts once per visit, events are sent together in one
// small request (when the page is hidden or closed, or after a short wait),
// and nothing about the visitor is sent. Visitors who ask not to be tracked
// (Global Privacy Control or Do Not Track) send nothing. Events from a visit
// with no connection are kept on the device and sent once it's back online.

import { MAX_EVENTS_PER_REQUEST, type StatEvent } from './stats';

const ENDPOINT = '/api/stats';
const SEND_AFTER_MS = 30_000;
/** Events waiting for a connection, in localStorage. */
export const PENDING_KEY = 'cw:stats-pending';
const MAX_PENDING = 50;

const readPending = (): StatEvent[] => {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const writePending = (events: StatEvent[]) => {
  try {
    if (events.length) globalThis.localStorage?.setItem(PENDING_KEY, JSON.stringify(events.slice(-MAX_PENDING)));
    else globalThis.localStorage?.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: they're dropped, as before.
  }
};
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** True for visitors who ask not to be tracked (Global Privacy Control or Do Not Track). */
export const optedOut = () => {
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
  // No connection: keep them for later rather than lose them.
  if (offline()) {
    writePending([...readPending(), ...queue]);
    queue = [];
    return;
  }
  const events = queue;
  queue = [];
  // The server takes at most MAX_EVENTS_PER_REQUEST a request (kept events plus new ones can be more).
  for (let i = 0; i < events.length; i += MAX_EVENTS_PER_REQUEST) send(events.slice(i, i + MAX_EVENTS_PER_REQUEST));
}

function send(events: StatEvent[]) {
  const body = JSON.stringify({ events });
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
  window.addEventListener('online', sendPending);
};

/** Sends events kept from a time with no connection (this visit or an earlier one). */
export function sendPending() {
  if (optedOut() || offline()) return;
  const pending = readPending();
  if (pending.length === 0) return;
  writePending([]);
  queue.push(...pending);
  flush();
}

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
