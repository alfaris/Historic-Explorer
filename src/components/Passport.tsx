import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Binoculars, Image as ImageIcon, Stamp as StampIcon, X } from 'lucide-react';
import type { Route } from '../data/locations';
import { stampCount, stampDate, useStamps, type Stamp } from '../lib/passport';
import { useDialog } from '../lib/useDialog';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = 'Inter, system-ui, sans-serif';
const ARABIC = 'Cairo, Tahoma, sans-serif';

export const walksLabel = (n: number, total: number) =>
  byLang({
    en: `${n} of ${total} walks`,
    ar: `${n} من ${total} جولات`,
    fr: `${n} visite${n === 1 ? '' : 's'} sur ${total}`,
    es: `${n} de ${total} paseos`,
  });

const spotsLabel = (s: Stamp) =>
  byLang({ en: `Spotted ${s.found} of ${s.spots}`, ar: `وجدت ${s.found} من ${s.spots}`, fr: `Repéré ${s.found} sur ${s.spots}`, es: `Encontrado ${s.found} de ${s.spots}` });

/** One stamp: the route's name and the day it was finished; dashed and grey until then. */
export function StampBadge({ route, stamp, size = 'md' }: { route: Route; stamp?: Stamp; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-36 h-36' : 'w-28 h-28 sm:w-32 sm:h-32';
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={`${box} rounded-full flex flex-col items-center justify-center p-3 ${
          stamp ? 'border-4 border-gold bg-gold/15 -rotate-6' : 'border-2 border-dashed border-sand text-stone-400'
        }`}
      >
        <span className={`text-xs font-bold leading-tight line-clamp-3 ${stamp ? 'text-ink' : ''}`}>{nameOf(route)}</span>
        {stamp ? (
          <span className="mt-1 text-[11px] font-bold text-gold-ink">{stampDate(stamp.date, currentLang())}</span>
        ) : (
          <span className="mt-1 text-[11px]">{L('Not yet', 'ليس بعد')}</span>
        )}
      </div>
      {stamp && stamp.spots > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-stone-500">
          <Binoculars className="w-3 h-3" aria-hidden="true" />
          {spotsLabel(stamp)}
        </span>
      )}
    </div>
  );
}

/** "Passport 1/5" beside Saved, over the routes. */
export function PassportButton({ routes }: { routes: Route[] }) {
  const [open, setOpen] = useState(false);
  const stamps = useStamps();
  const n = stampCount(stamps, routes);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex shrink-0 items-center gap-2 min-h-11 px-3 sm:px-4 rounded-full border border-sand bg-white text-xs font-bold uppercase tracking-widest text-ink shadow-sm hover:border-nile transition-colors"
      >
        <StampIcon className={`w-4 h-4 ${n ? 'text-gold-ink' : 'text-stone-500'}`} aria-hidden="true" />
        {/* On phones, the stamp and the count only, so Saved still fits beside it. */}
        <span className="sr-only sm:not-sr-only">{L('Passport', 'جواز السفر')}</span>
        <span className="tabular-nums tracking-normal text-stone-500" aria-hidden="true">{n}/{routes.length}</span>
        <span className="sr-only"> ({walksLabel(n, routes.length)})</span>
      </button>
      {open && <PassportSheet routes={routes} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The passport: every route's stamp, and Share my passport. */
export function PassportSheet({ routes, onClose }: { routes: Route[]; onClose: () => void }) {
  const stamps = useStamps();
  const n = stampCount(stamps, routes);
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = currentLang() === 'ar';
  return createPortal(
    <div className="fixed inset-0 z-[7200] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
      >
        <div className="px-5 pt-5 pb-4 border-b border-sand/50">
          <button onClick={onClose} className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink" aria-label={L('Close', 'إغلاق')}>
            <X className="w-5 h-5" />
          </button>
          <h2 id="passport-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('My Cairo passport', 'جواز سفري في القاهرة')}</h2>
          <p className="text-sm text-stone-500">{walksLabel(n, routes.length)}</p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5 justify-items-center">
          {routes.map(r => (
            <li key={r.id}>
              <StampBadge route={r} stamp={stamps[r.id]} />
            </li>
          ))}
        </ul>
        <div className="px-5 pb-5 space-y-2">
          <p className="text-xs text-stone-500">
            {n === 0
              ? L('Visit every stop of a route to get its stamp.', 'زر كل محطات المسار لتحصل على ختمه.')
              : L('Stamps are kept on this device only.', 'تُحفظ الأختام على هذا الجهاز فقط.')}
          </p>
          {n > 0 && <SharePassport routes={routes} />}
        </div>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}

/** Shares an image of the passport through the phone's share sheet, or saves it. Made on the device. */
function SharePassport({ routes }: { routes: Route[] }) {
  const stamps = useStamps();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const lang = currentLang();
  const ar = lang === 'ar';
  const build = async () => {
    const sans = ar ? ARABIC : SANS;
    if (document.fonts?.load) {
      const families = ar ? [ARABIC] : [SERIF, SANS];
      await Promise.race([Promise.all(families.map(f => document.fonts.load(`700 48px ${f}`).catch(() => []))), new Promise(r => setTimeout(r, 1500))]);
    }
    // The drawing code loads only when the passport is opened with stamps to share.
    const { makePassportImage } = await import('../lib/passport-image');
    const blob = await makePassportImage({
      title: L('My Cairo passport', 'جواز سفري في القاهرة'),
      count: walksLabel(stampCount(stamps, routes), routes.length),
      stamps: routes.map(r => ({ name: nameOf(r), date: stamps[r.id] ? stampDate(stamps[r.id].date, lang) : null })),
      brand: ar ? 'Cairo Walks · جولات القاهرة' : 'Cairo Walks',
      rtl: ar,
      serif: SERIF,
      sans,
    });
    return new File([blob], 'cairo-walks-passport.png', { type: 'image/png' });
  };
  // Made when the sheet opens: sharing is only allowed straight after a tap.
  const ready = useRef<Promise<File> | null>(null);
  const key = `${JSON.stringify(stamps)}|${lang}`;
  useEffect(() => {
    const p = build();
    p.catch(() => {});
    ready.current = p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const share = async () => {
    setMessage(null);
    try {
      const file = await (ready.current ?? build());
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: L('My Cairo passport', 'جواز سفري في القاهرة'), text: window.location.origin });
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setMessage({ text: L('Saved to your downloads.', 'تم الحفظ في التنزيلات.'), error: false });
    } catch {
      setMessage({ text: L("The image couldn't be made on this device.", 'تعذر إنشاء الصورة على هذا الجهاز.'), error: true });
    }
  };
  return (
    <>
      <button type="button" onClick={share} className="flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-sand text-ink text-xs font-bold uppercase tracking-widest hover:border-nile">
        <ImageIcon className="w-4 h-4" aria-hidden="true" /> {L('Share my passport', 'شارك جواز سفري')}
      </button>
      {message && <p className={`text-xs ${message.error ? 'text-red-700' : 'text-nile'}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </>
  );
}
