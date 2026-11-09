import React, { useSyncExternalStore } from 'react';
import { Megaphone, TriangleAlert, X } from 'lucide-react';
import { useContent } from '../data/ContentContext';
import { noticeKey, noticesFor, noticeText, type NoticeScope } from '../lib/notices';
import { cairoDate } from '../lib/special-hours';
import { L, currentLang } from '../i18n/lang';

// Notices the visitor closed, by noticeKey (an edited notice gets a new key and
// shows again). Kept on the device; the newest 50 are remembered.
const STORAGE_KEY = 'cairo-walks:notices-dismissed';
const MAX = 50;
let dismissed: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
const current = () => (dismissed ??= typeof window === 'undefined' ? [] : read());
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      dismissed = read();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
function dismiss(key: string) {
  // From the stored list (another tab may have added to it) and this tab's own,
  // so a dismissal that couldn't be saved isn't lost by the next one.
  dismissed = [...new Set([...read(), ...current()].filter(k => k !== key)), key].slice(-MAX);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  } catch {
    // Not saved: closed until the page is reloaded.
  }
  listeners.forEach(l => l());
}

/**
 * The admin's notices for one part of the screen (app-wide, a route or a
 * place) that show today in Cairo. Important ones come first and can't be
 * closed; the others have a close button. Nothing when there are none.
 */
export function Notices({ scope, className = '' }: { scope: NoticeScope; className?: string }) {
  const { notices } = useContent();
  const closed = useSyncExternalStore(subscribe, current, current);
  if (!notices?.length) return null;
  const lang = currentLang();
  const showing = noticesFor(notices, cairoDate(new Date()), scope).filter(n => n.important || !closed.includes(noticeKey(n)));
  if (!showing.length) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {showing.map(n => {
        const key = noticeKey(n);
        const { text, lang: textLang } = noticeText(n, lang);
        const Icon = n.important ? TriangleAlert : Megaphone;
        return (
          <aside
            key={key}
            aria-label={n.important ? L('Important notice', 'تنبيه مهم') : L('Notice', 'إعلان')}
            className={`flex items-start gap-2 rounded-2xl border p-3 text-sm text-start ${
              n.important ? 'bg-red-50 border-red-100/50 text-red-800' : 'bg-amber-50 border-sand/60 text-amber-900'
            }`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="flex-1 leading-snug" lang={textLang}>{text}</p>
            {!n.important && (
              <button
                type="button"
                onClick={() => dismiss(key)}
                aria-label={L('Close this notice', 'إغلاق هذا الإعلان')}
                className="-m-2 min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-black/5"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </aside>
        );
      })}
    </div>
  );
}
