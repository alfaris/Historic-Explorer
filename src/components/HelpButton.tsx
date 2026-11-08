import React, { Suspense, lazy, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { L } from '../i18n/lang';

// The sheet loads only when opened (and is in the offline cache like the rest of the app).
const HelpSheet = lazy(() => import('./HelpSheet'));

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
        <Suspense fallback={null}>
          <HelpSheet route={route} places={places} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
