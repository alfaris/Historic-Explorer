import React, { lazy, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Flag, LocateFixed, X } from 'lucide-react';
import type { Location } from '../data/locations';
import { LazyBoundary } from './LazyBoundary';
import { useDialog } from '../lib/useDialog';
import type { LatLng } from './LocationPicker';

import { L, nameOf, currentLang } from '../i18n/lang';
const LocationPicker = lazy(() => import('./LocationPicker'));

type ReportType = 'location' | 'text' | 'closed' | 'photo';

const TYPES: { id: ReportType; en: string; ar: string }[] = [
  { id: 'location', en: 'Wrong location on the map', ar: 'الموقع على الخريطة خاطئ' },
  { id: 'text', en: 'Wrong name or description', ar: 'الاسم أو الوصف خاطئ' },
  { id: 'closed', en: 'Closed or no longer exists', ar: 'مغلق أو لم يعد موجوداً' },
  { id: 'photo', en: 'Problem with the photo', ar: 'مشكلة في الصورة' },
];

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
        className="inline-flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-nile transition-colors"
      >
        <Flag className="w-3.5 h-3.5" />
        {L('Report a problem', 'الإبلاغ عن خطأ')}
      </button>
      {/* Portalled to <body>: the place cards are animated with CSS transforms,
          which would otherwise trap a position: fixed dialog inside the card. */}
      {open && createPortal(<ReportDialog place={place} isArabic={isArabic} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function ReportDialog({ place, isArabic, onClose }: { place: Location; isArabic: boolean; onClose: () => void }) {
  const [type, setType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState('');
  const [spot, setSpot] = useState<LatLng>({ lat: place.lat, lng: place.lng });
  const [source, setSource] = useState<'map' | 'gps'>('map');
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const { ref: panelRef, guard } = useDialog<HTMLDivElement>(onClose);
  const t = L;

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setError(t("This browser can't share your location.", 'تحديد الموقع غير مدعوم في هذا المتصفح.'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSpot({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
        setSource('gps');
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
        setError(null);
      },
      () => {
        setLocating(false);
        setError(t("Couldn't get your location. You can drag the pin instead.", 'تعذر تحديد موقعك. يمكنك سحب الدبوس بدلاً من ذلك.'));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const needsMessage = type === 'text' || type === 'photo';
  const moved = spot.lat !== place.lat || spot.lng !== place.lng;
  const canSend = type !== null && (!needsMessage || message.trim().length >= 3) && (type !== 'location' || moved) && state === 'idle';

  const send = async () => {
    if (!type) return;
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          placeId: place.id,
          message,
          lang: currentLang(),
          website,
          ...(type === 'location' ? { suggested: { ...spot, source, accuracy } } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setState('sent');
    } catch (err) {
      setState('idle');
      setError((err as Error).message || t('Sending failed. Please try again.', 'فشل الإرسال. حاول مرة أخرى.'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[6000] bg-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
      onClick={e => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Report a problem', 'الإبلاغ عن خطأ')}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <span {...guard('start')} />
      <div ref={panelRef} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink mb-1">{t('Report a problem', 'الإبلاغ عن خطأ')}</p>
            <p className="text-lg text-ink font-serif leading-tight">{nameOf(place)}</p>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-ink" aria-label={t('Close', 'إغلاق')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {state === 'sent' ? (
          <div className="text-center py-6">
            <CircleCheck className="w-10 h-10 text-nile mx-auto mb-3" />
            <p className="text-ink font-bold mb-1">{t('Thank you!', 'شكراً لك!')}</p>
            <p className="text-sm text-stone-500 mb-6">{t('We’ll check it and fix the information.', 'سنراجع البلاغ ونصحح المعلومات.')}</p>
            <button onClick={onClose} className="px-6 py-3 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest">
              {t('Done', 'تم')}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="space-y-2 mb-5">
              <legend className="text-xs font-bold text-stone-500 mb-2">{t('What’s wrong?', 'ما المشكلة؟')}</legend>
              {TYPES.map(opt => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    type === opt.id ? 'border-nile bg-nile/5' : 'border-sand/60 hover:border-sand'
                  }`}
                >
                  <input type="radio" name="report-type" value={opt.id} checked={type === opt.id} onChange={() => setType(opt.id)} className="accent-[#1f4d3a]" />
                  <span className="text-sm text-ink">{L(opt.en, opt.ar)}</span>
                </label>
              ))}
            </fieldset>

            {type === 'location' && (
              <div className="mb-5">
                <p className="text-xs text-stone-500 mb-2">
                  {t('Drag the gold pin (or tap the map) to the right spot. The grey pin is where it is now.', 'اسحب الدبوس الذهبي (أو اضغط على الخريطة) إلى المكان الصحيح. الدبوس الرمادي هو الموقع الحالي.')}
                </p>
                <LazyBoundary
                  loading={<div className="h-[260px] rounded-2xl bg-chalk animate-pulse" />}
                  failed={<p className="text-sm text-stone-500">{t("The map couldn't load. Use your current location instead.", 'تعذر تحميل الخريطة. استخدم موقعك الحالي بدلاً من ذلك.')}</p>}
                >
                  <LocationPicker
                    value={spot}
                    reference={{ lat: place.lat, lng: place.lng }}
                    onChange={v => {
                      setSpot(v);
                      setSource('map');
                      setAccuracy(undefined);
                    }}
                  />
                </LazyBoundary>
                <button
                  onClick={useMyLocation}
                  disabled={locating}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-nile hover:text-nile-light disabled:opacity-50"
                >
                  <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
                  {t('I’m standing here now', 'أنا واقف هنا الآن')}
                </button>
              </div>
            )}

            {type && (
              <label className="block mb-5">
                <span className="text-xs font-bold text-stone-500">
                  {needsMessage ? t('Details', 'التفاصيل') : t('Details (optional)', 'تفاصيل (اختياري)')}
                </span>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder={
                    type === 'text'
                      ? t('What should it say?', 'ما الصحيح؟')
                      : type === 'photo'
                        ? t('What’s wrong with the photo?', 'ما مشكلة الصورة؟')
                        : t('Anything we should know?', 'هل هناك ما يجب أن نعرفه؟')
                  }
                  className="mt-1 w-full rounded-xl border border-sand/60 p-3 text-sm focus:outline-none focus:border-nile"
                />
              </label>
            )}

            {/* Hidden from people; bots tend to fill it in. */}
            <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

            <button
              onClick={send}
              disabled={!canSend}
              className="w-full py-4 rounded-2xl bg-nile text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === 'sending' ? t('Sending…', 'جارٍ الإرسال…') : t('Send report', 'إرسال البلاغ')}
            </button>
            <p className="text-[11px] text-stone-400 mt-3 text-center">
              {t('Reports don’t include your name or contact details.', 'لا تتضمن البلاغات اسمك أو بيانات الاتصال بك.')}
            </p>
          </>
        )}
      </div>
      <span {...guard('end')} />
    </div>
  );
}
