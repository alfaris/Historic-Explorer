import React, { lazy, useState } from 'react';
import { createPortal } from 'react-dom';
import { LifeBuoy, Phone, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { EMERGENCY } from '../lib/help';
import { L } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';

// The sheet loads only when opened (and is in the offline cache like the rest of the app).
const HelpSheet = lazy(() => import('./HelpSheet'));

/**
 * If the sheet can't be downloaded (offline before the app was cached), the
 * emergency numbers still show, here, rather than nothing (or a blank app).
 */
function HelpFailed({ onClose }: { onClose: () => void }) {
  const label = (id: string) => (id === 'ambulance' ? L('Ambulance', 'الإسعاف') : id === 'touristPolice' ? L('Tourist police', 'شرطة السياحة') : id === 'police' ? L('Police', 'الشرطة') : L('Fire', 'المطافئ'));
  // On the page's body: inside the header (a backdrop filter), "fixed" would be relative to the header.
  return createPortal(
    <div role="alertdialog" aria-labelledby="help-failed" className="fixed inset-x-4 bottom-24 z-[7300] mx-auto max-w-md rounded-2xl bg-white border border-sand shadow-2xl p-4">
      <div className="flex items-start gap-2">
        <p id="help-failed" className="flex-1 text-sm text-ink">{L("Help couldn't load. Check your connection. Emergency numbers:", 'تعذر تحميل المساعدة. تحقق من اتصالك. أرقام الطوارئ:')}</p>
        <button type="button" onClick={onClose} aria-label={L('Close', 'إغلاق')} className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-stone-500">
          <X className="w-5 h-5" />
        </button>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {EMERGENCY.map(e => (
          <li key={e.id}>
            <a href={`tel:${e.number}`} className="flex items-center gap-2 min-h-11 px-3 rounded-xl border border-sand text-sm">
              <Phone className="w-4 h-4 text-red-700" aria-hidden="true" />
              {label(e.id)} <span className="font-bold text-red-700" dir="ltr">{e.number}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

/** The Help button in the header, beside language and display. */
export function HelpButton({ route, places }: { route?: Route; places: Location[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="group flex flex-col items-center gap-1 shrink-0">
        <span className="w-12 h-12 rounded-full border border-sand group-hover:border-red-400 transition-all duration-500 flex items-center justify-center bg-white shadow-sm">
          <LifeBuoy className="w-5 h-5 text-red-700" aria-hidden="true" />
        </span>
        <span className="hidden sm:block text-xs font-bold text-stone-400 uppercase tracking-widest">{L('Help', 'المساعدة')}</span>
        <span className="sr-only sm:hidden">{L('Help', 'المساعدة')}</span>
      </button>
      {open && (
        <LazyBoundary loading={null} failed={<HelpFailed onClose={() => setOpen(false)} />}>
          <HelpSheet route={route} places={places} onClose={() => setOpen(false)} />
        </LazyBoundary>
      )}
    </>
  );
}
