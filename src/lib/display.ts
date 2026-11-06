// Reading comfort outdoors: a text size and a high-contrast option, kept on
// the device. Applied as data attributes on <html>; index.css scales the text
// sizes and darkens the greys and gold from there, so only text grows (not
// spacing) and every component follows without changes.

import { useSyncExternalStore } from 'react';

export const TEXT_SIZES = ['standard', 'large', 'larger'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export interface DisplayPrefs {
  text: TextSize;
  contrast: boolean;
}

export const DISPLAY_KEY = 'cw:display';

/**
 * Stored preferences, or the defaults: standard text, and high contrast when
 * the device asks for more contrast (`prefers-contrast: more`).
 */
export function readDisplay(stored: string | null, prefersMore: boolean): DisplayPrefs {
  try {
    const v = stored ? JSON.parse(stored) : null;
    if (v && typeof v === 'object') {
      return {
        text: (TEXT_SIZES as readonly string[]).includes(v.text) ? v.text : 'standard',
        contrast: typeof v.contrast === 'boolean' ? v.contrast : prefersMore,
      };
    }
  } catch {
    // Unreadable: the defaults.
  }
  return { text: 'standard', contrast: prefersMore };
}

/** The attributes for <html>. */
export const displayAttributes = (p: DisplayPrefs) => ({ 'data-text': p.text, 'data-contrast': p.contrast ? 'more' : 'standard' });

const prefersMore = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-contrast: more)').matches;
const stored = () => {
  try {
    return window.localStorage.getItem(DISPLAY_KEY);
  } catch {
    return null;
  }
};

let prefs: DisplayPrefs | null = null;
const listeners = new Set<() => void>();
const current = () => (prefs ??= typeof window === 'undefined' ? { text: 'standard', contrast: false } : readDisplay(stored(), prefersMore()));

/** Puts the preferences on <html>. Called once before the app renders, so nothing flashes. */
export function applyDisplay(p: DisplayPrefs = current()) {
  if (typeof document === 'undefined') return;
  for (const [k, v] of Object.entries(displayAttributes(p))) document.documentElement.setAttribute(k, v);
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
