// Reading comfort outdoors and at night: a text size, a high-contrast option
// and a theme (light, dark, or following the phone), plus a data saver for
// mobile data, kept on the device. Applied as data attributes on <html>; index.css scales the text
// sizes and darkens the greys and gold from there, so only text grows (not
// spacing) and every component follows without changes.

import { useSyncExternalStore } from 'react';

export const TEXT_SIZES = ['standard', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export interface DisplayPrefs {
  text: TextSize;
  contrast: boolean;
  /** "auto" follows the phone's light or dark setting. */
  theme: Theme;
  /** Photos load when tapped and audio guides when played (not in the background). */
  dataSaver: boolean;
}

export const DISPLAY_KEY = 'cw:display';

/**
 * Stored preferences, or the defaults: standard text, high contrast when the
 * device asks for more contrast (`prefers-contrast: more`), and the data
 * saver when the browser asks to save data (`Save-Data`).
 */
export function readDisplay(stored: string | null, prefersMore: boolean, saveData = false): DisplayPrefs {
  try {
    const v = stored ? JSON.parse(stored) : null;
    if (v && typeof v === 'object') {
      return {
        text: (TEXT_SIZES as readonly string[]).includes(v.text) ? v.text : 'standard',
        contrast: typeof v.contrast === 'boolean' ? v.contrast : prefersMore,
        theme: (THEMES as readonly string[]).includes(v.theme) ? v.theme : 'auto',
        dataSaver: typeof v.dataSaver === 'boolean' ? v.dataSaver : saveData,
      };
    }
  } catch {
    // Unreadable: the defaults.
  }
  return { text: 'standard', contrast: prefersMore, theme: 'auto', dataSaver: saveData };
}

/** Light or dark, with "auto" following the phone. */
export const resolvedTheme = (p: DisplayPrefs, prefersDark: boolean): 'light' | 'dark' =>
  p.theme === 'auto' ? (prefersDark ? 'dark' : 'light') : p.theme;

/** The attributes for <html>. */
export const displayAttributes = (p: DisplayPrefs, prefersDark = false) => ({
  'data-text': p.text,
  'data-contrast': p.contrast ? 'more' : 'standard',
  'data-theme': resolvedTheme(p, prefersDark),
});

const darkQuery = () => (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined);

const prefersMore = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-contrast: more)').matches;
/** The browser's "save data" (Chrome's Lite mode, Android data saver). */
const saveData = () =>
  typeof navigator !== 'undefined' && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const stored = () => {
  try {
    return window.localStorage.getItem(DISPLAY_KEY);
  } catch {
    return null;
  }
};

let prefs: DisplayPrefs | null = null;
const listeners = new Set<() => void>();
const current = () =>
  (prefs ??= typeof window === 'undefined' ? { text: 'standard', contrast: false, theme: 'auto', dataSaver: false } : readDisplay(stored(), prefersMore(), saveData()));

let watching = false;
/** Puts the preferences on <html>. Called once before the app renders, so nothing flashes. */
export function applyDisplay(p: DisplayPrefs = current()) {
  if (typeof document === 'undefined') return;
  const attrs = displayAttributes(p, !!darkQuery()?.matches);
  for (const [k, v] of Object.entries(attrs)) document.documentElement.setAttribute(k, v);
  // The browser's own bar and the phone's status bar follow the theme.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', attrs['data-theme'] === 'dark' ? '#121517' : '#f8f7f4');
  // "Auto" follows the phone when it switches (e.g. at sunset) while the app is open.
  if (!watching) {
    watching = true;
    darkQuery()?.addEventListener?.('change', () => applyDisplay());
  }
}

export function setDisplay(patch: Partial<DisplayPrefs>) {
  prefs = { ...current(), ...patch };
  try {
    window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered; it still applies now.
  }
  applyDisplay(prefs);
  listeners.forEach(l => l());
}

export function useDisplay(): DisplayPrefs {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    current,
  );
}
