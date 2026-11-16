import React, { lazy, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import type { Location } from '../data/locations';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';
import { L } from '../i18n/lang';

// The form loads only when opened (and is in the offline cache like the rest of the app).
const ReportDialog = lazy(() => import('./ReportDialog'));

/** "Report a problem" link that opens a short form, sent to the admin dashboard. */
export function ReportProblem({ place, isArabic }: { place: Location; isArabic: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-nile transition-colors"
      >
        <Flag className="w-3.5 h-3.5" />
        {L('Report a problem', 'الإبلاغ عن خطأ')}
      </button>
      {/* Portalled to <body>: the place cards are animated with CSS transforms,
          which would otherwise trap a position: fixed dialog inside the card. */}
      {open && (
        <LazyBoundary loading={null} failed={<SheetFailed onClose={() => setOpen(false)} />}>
          {createPortal(<ReportDialog place={place} isArabic={isArabic} onClose={() => setOpen(false)} />, document.body)}
        </LazyBoundary>
      )}
    </>
  );
}
