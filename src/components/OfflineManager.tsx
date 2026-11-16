import React, { lazy, useState } from 'react';
import { offlineSupported } from '../lib/offline-store';
import { L } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';

// The sheet loads only when opened (and is in the offline cache like the rest of the app).
const OfflineSheet = lazy(() => import('./OfflineSheet'));

/** "Offline routes": every route's offline copy in one place, with "Download all". */
export function OfflineManager() {
  const [open, setOpen] = useState(false);
  if (!offlineSupported()) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-h-11 px-3 text-xs font-bold text-nile underline underline-offset-4 hover:no-underline">
        {L('Offline routes', 'المسارات دون إنترنت')}
      </button>
      {open && (
        <LazyBoundary loading={null} failed={<SheetFailed onClose={() => setOpen(false)} />}>
          <OfflineSheet onClose={() => setOpen(false)} />
        </LazyBoundary>
      )}
    </>
  );
}
