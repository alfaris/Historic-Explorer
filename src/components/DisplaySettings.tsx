import React, { lazy, useState } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { L, LANGUAGES } from '../i18n/lang';
import { LazyBoundary } from './LazyBoundary';
import { SheetFailed } from './SheetFailed';

// The sheet loads only when opened (and is in the offline cache like the rest of the app).
const DisplaySheet = lazy(() => import('./DisplaySheet'));

/**
 * The header's globe: language, text size, theme, high contrast and the data saver in one small
 * sheet (the header has room for one control on a 360px phone).
 */
export function DisplaySettings() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="group flex flex-col items-center gap-1 shrink-0">
        <span className="relative w-12 h-12 rounded-full border border-sand group-hover:border-nile transition-all duration-500 flex items-center justify-center bg-white shadow-sm">
          <Globe className="w-4 h-4 text-stone-400 group-hover:text-nile transition-colors" aria-hidden="true" />
          <span className="absolute -bottom-0.5 -end-0.5 rounded-full bg-white border border-sand px-1 text-[12px] font-bold leading-4 text-stone-500" aria-hidden="true">Aa</span>
        </span>
        <span className="hidden sm:block text-xs font-bold text-stone-400 uppercase tracking-widest" aria-hidden="true">
          {LANGUAGES[language].native}
        </span>
        <span className="sr-only">{L('Language and display', 'اللغة والعرض')}</span>
      </button>
      {open && (
        <LazyBoundary loading={null} failed={<SheetFailed onClose={() => setOpen(false)} />}>
          <DisplaySheet onClose={() => setOpen(false)} />
        </LazyBoundary>
      )}
    </>
  );
}
