import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Monitor, Moon, Sun, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { L, LANGS, LANGUAGES } from '../i18n/lang';
import { TEXT_SIZES, THEMES, setDisplay, useDisplay, type TextSize, type Theme } from '../lib/display';
import { useDialog } from '../lib/useDialog';

const sizeLabel = (s: TextSize) => (s === 'standard' ? L('Standard', 'عادي') : s === 'large' ? L('Large', 'كبير') : L('Larger', 'أكبر'));
const themeLabel = (t: Theme) => (t === 'auto' ? L('Auto', 'تلقائي') : t === 'light' ? L('Light', 'فاتح') : L('Dark', 'داكن'));
const THEME_ICON = { auto: Monitor, light: Sun, dark: Moon } as const;
// The sample letters in each option, at roughly the size it gives.
const SAMPLE: Record<TextSize, string> = { standard: 'text-base', large: 'text-lg', larger: 'text-xl' };

function Sheet({ onClose }: { onClose: () => void }) {
  const { language, setLanguage } = useLanguage();
  const display = useDisplay();
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = language === 'ar';

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-title"
        dir={LANGUAGES[language].dir}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto p-5 space-y-5"
      >
        <button
          onClick={onClose}
          className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink"
          aria-label={L('Close', 'إغلاق')}
        >
          <X className="w-5 h-5" />
        </button>
        <h2 id="display-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Language and display', 'اللغة والعرض')}</h2>

        <label className="block">
          <span className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">{L('Language', 'اللغة')}</span>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as typeof language)}
            aria-label="Language / اللغة / Langue / Idioma"
            className="block w-full min-h-11 rounded-xl border border-sand bg-white px-3 text-base text-ink"
          >
            {LANGS.map(l => (
              <option key={l} value={l} lang={l}>{LANGUAGES[l].native}</option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{L('Text size', 'حجم النص')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_SIZES.map(size => (
              <label
                key={size}
                className={`flex flex-col items-center justify-center gap-1 min-h-16 rounded-2xl border px-2 py-2 text-center cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-nile ${
                  display.text === size ? 'border-nile bg-nile/10 text-nile font-bold' : 'border-sand text-ink hover:border-nile/50'
                }`}
              >
                <input type="radio" name="text-size" value={size} checked={display.text === size} onChange={() => setDisplay({ text: size })} className="sr-only" />
                <span className={`${SAMPLE[size]} leading-none`} aria-hidden="true">Aa</span>
                <span className="text-xs">{sizeLabel(size)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{L('Theme', 'المظهر')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(theme => {
              const Icon = THEME_ICON[theme];
              return (
                <label
                  key={theme}
                  className={`flex flex-col items-center justify-center gap-1 min-h-16 rounded-2xl border px-2 py-2 text-center cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-nile ${
                    display.theme === theme ? 'border-nile bg-nile/10 text-nile font-bold' : 'border-sand text-ink hover:border-nile/50'
                  }`}
                >
                  <input type="radio" name="theme" value={theme} checked={display.theme === theme} onChange={() => setDisplay({ theme })} className="sr-only" />
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-xs">{themeLabel(theme)}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-stone-500">{L('Auto follows your phone.', 'التلقائي يتبع إعداد هاتفك.')}</p>
        </fieldset>

        <label className="flex items-start gap-3 cursor-pointer min-h-11">
          <input type="checkbox" checked={display.contrast} onChange={e => setDisplay({ contrast: e.target.checked })} className="mt-1 w-5 h-5 accent-nile" />
          <span>
            <span className="block text-sm font-bold text-ink">{L('High contrast', 'تباين عالٍ')}</span>
            <span className="block text-xs text-stone-500">{L('Easier to read in bright sun.', 'أسهل للقراءة تحت الشمس الساطعة.')}</span>
          </span>
        </label>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}

/**
 * The header's globe: language, text size and high contrast in one small
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
      {open && <Sheet onClose={() => setOpen(false)} />}
    </>
  );
}
