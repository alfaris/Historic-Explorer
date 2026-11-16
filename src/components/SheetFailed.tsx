import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { L } from '../i18n/lang';

/**
 * Shown instead of a sheet or dialog whose code couldn't be downloaded
 * (offline before the app was cached), so the tap isn't silently lost.
 */
export function SheetFailed({ onClose }: { onClose: () => void }) {
  // On the page's body: inside the header (a backdrop filter), "fixed" would be relative to the header.
  return createPortal(
    <div role="alertdialog" aria-labelledby="sheet-failed" className="fixed inset-x-4 bottom-24 z-[7300] mx-auto max-w-md rounded-2xl bg-white border border-sand shadow-2xl p-4">
      <div className="flex items-start gap-2">
        <p id="sheet-failed" className="flex-1 text-sm text-ink">{L("This couldn't load. Check your connection and try again.", 'تعذر التحميل. تحقق من اتصالك وحاول مرة أخرى.')}</p>
        <button type="button" onClick={onClose} aria-label={L('Close', 'إغلاق')} className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-stone-500">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
