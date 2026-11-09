import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Copy, LocateFixed, MapPin, Phone, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { formatDistance, nearest, type Point } from '../lib/geo';
import { EMERGENCY, phrases, positionLink, positionText, type EmergencyId, type Phrase } from '../lib/help';
import { startPlace } from '../lib/getting-there';
import { useDialog } from '../lib/useDialog';
import { walkStops } from '../lib/walk';
import { L, currentLang, nameOf, optionalText } from '../i18n/lang';
import { useContent } from '../data/ContentContext';
import { telHref } from '../lib/help-content';

const serviceLabel = (id: EmergencyId) =>
  id === 'ambulance' ? L('Ambulance', 'الإسعاف') : id === 'touristPolice' ? L('Tourist police', 'شرطة السياحة') : id === 'police' ? L('Police', 'الشرطة') : L('Fire', 'المطافئ');

const phraseMeaning = (id: string) =>
  id === 'help' ? L('I need help, please.', 'أحتاج إلى مساعدة، من فضلك.')
  : id === 'ambulance' ? L('Please call an ambulance.', 'من فضلك، اتصل بالإسعاف.')
  : id === 'toilet' ? L('Where is the nearest toilet?', 'أين أقرب دورة مياه؟')
  : id === 'water' ? L('Where can I find drinking water?', 'أين أجد ماءً للشرب؟')
  : L("I'm lost. Please help me get to the start of my walk.", 'أنا تائه. من فضلك ساعدني في الوصول إلى بداية جولتي.');

/** A phrase to show: the built-in ones (meaning from phraseMeaning) or the admin's (own meaning). */
type Shown = Phrase & { meaning?: { text: string; lang: 'en' | undefined } };

type Where = { state: 'idle' | 'finding' | 'denied' | 'unavailable' } | { state: 'found'; at: Point };

/**
 * Help, from the header: emergency numbers to call with one tap, where the
 * visitor is (coordinates, a maps link and the nearest stop), phrases to show
 * in large Arabic, and practical tips. Works offline (the position comes from
 * the phone's GPS). Loaded only when opened.
 */
export default function HelpSheet({ route, places, onClose }: { route?: Route; places: Location[]; onClose: () => void }) {
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const ar = currentLang() === 'ar';
  const [where, setWhere] = useState<Where>({ state: 'idle' });
  const [copied, setCopied] = useState(false);
  // A phrase shown large, in place of the sheet (one dialog, so focus stays in it).
  const [shown, setShown] = useState<Shown | null>(null);
  const start = route ? startPlace(route, places) : undefined;
  // The admin's own contacts, tips and phrases (Help in the admin), after the built-in ones.
  const help = useContent().help;
  const allPhrases: Shown[] = [
    ...phrases(start?.nameAr),
    ...(help?.phrases ?? []).map((p, i) => ({ id: `own-${i}`, ar: p.ar, meaning: optionalText(p, 'meaning') })),
  ];
  // Focus follows the switch: to Back when a phrase opens, and back to that phrase's button on return.
  const backButton = useRef<HTMLButtonElement>(null);
  const lastPhrase = useRef<string | null>(null);
  useEffect(() => {
    if (shown) {
      lastPhrase.current = shown.id;
      backButton.current?.focus();
    } else if (lastPhrase.current) {
      ref.current?.querySelector<HTMLElement>(`[data-phrase="${lastPhrase.current}"]`)?.focus();
    }
  }, [shown, ref]);
  const near = where.state === 'found' && route ? nearest(where.at, walkStops(places, route.id)) : null;

  const locate = () => {
    if (!navigator.geolocation) return setWhere({ state: 'unavailable' });
    setWhere({ state: 'finding' });
    navigator.geolocation.getCurrentPosition(
      p => setWhere({ state: 'found', at: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      err => setWhere({ state: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard blocked: the text is on screen to read out.
    }
  };

  const heading = `text-xs font-bold uppercase tracking-widest text-stone-500 mb-2`;
  return createPortal(
    <div className="fixed inset-0 z-[7300] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {shown ? (
          <div className="min-h-[70vh] flex flex-col p-6">
            <div className="flex items-center justify-between gap-3">
              <button ref={backButton} type="button" onClick={() => setShown(null)} className="flex items-center gap-1.5 min-h-11 px-2 text-sm font-bold text-nile">
                <ArrowLeft className={`w-4 h-4 ${ar ? 'rotate-180' : ''}`} aria-hidden="true" /> {L('Back', 'رجوع')}
              </button>
              <p id="help-title" className="text-sm text-stone-500">{L('Show this to someone', 'اعرض هذه الشاشة على أحد')}</p>
            </div>
            <p lang="ar" dir="rtl" className="flex-1 flex items-center justify-center text-center font-arabic text-4xl sm:text-5xl font-bold leading-snug text-ink py-8">{shown.ar}</p>
            {!ar && (
              <p className="text-center text-sm text-stone-500" lang={shown.meaning?.lang}>
                {shown.meaning ? shown.meaning.text : phraseMeaning(shown.id)}
              </p>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-6">
            <button onClick={onClose} className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink" aria-label={L('Close', 'إغلاق')}>
              <X className="w-5 h-5" />
            </button>
            <h2 id="help-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Help', 'المساعدة')}</h2>

            <section aria-labelledby="help-call">
              <h3 id="help-call" className={heading}>{L('Emergency numbers', 'أرقام الطوارئ')}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {EMERGENCY.map(e => (
                  <li key={e.id}>
                    <a href={`tel:${e.number}`} className="flex items-center gap-2 min-h-14 px-3 rounded-2xl border border-sand hover:border-red-400">
                      <Phone className="w-4 h-4 shrink-0 text-red-700" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{serviceLabel(e.id)}</span>
                        <span className="block text-lg font-bold tabular-nums text-red-700" dir="ltr">{e.number}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            {help && help.contacts.length > 0 && (
              <section aria-labelledby="help-contacts">
                <h3 id="help-contacts" className={heading}>{L('Local contacts', 'أرقام محلية')}</h3>
                <ul className="space-y-2">
                  {help.contacts.map((c, i) => {
                    const name = optionalText(c, 'name');
                    return (
                      <li key={i}>
                        <a href={telHref(c.phone)} className="flex items-center gap-3 min-h-14 px-3 rounded-2xl border border-sand hover:border-nile">
                          <Phone className="w-4 h-4 shrink-0 text-nile" aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-sm font-bold text-ink" lang={ar ? undefined : name.lang}>{ar ? c.nameAr : name.text}</span>
                          <span className="text-sm font-bold tabular-nums text-nile" dir="ltr">{c.phone}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-labelledby="help-where">
              <h3 id="help-where" className={heading}>{L('Where am I?', 'أين أنا؟')}</h3>
              {where.state === 'found' ? (
                <div className="rounded-2xl bg-chalk p-3 space-y-2" aria-live="polite">
                  <p className="text-lg font-bold tabular-nums text-ink" dir="ltr">{positionText(where.at)}</p>
                  {near && (
                    <p className="flex items-center gap-1.5 text-sm text-stone-600">
                      <MapPin className="w-4 h-4 shrink-0 text-gold-ink" aria-hidden="true" />
                      {L('Nearest stop', 'أقرب محطة')}: {nameOf(near.place)} · {formatDistance(near.meters, ar)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <a href={positionLink(where.at)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white text-xs font-bold text-ink border border-sand">
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {L('Open in maps', 'افتح في الخرائط')}
                    </a>
                    <button type="button" onClick={() => copy(`${positionText(where.at)}\n${positionLink(where.at)}`)} className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white text-xs font-bold text-ink border border-sand">
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {copied ? L('Copied', 'تم النسخ') : L('Copy to send', 'انسخ للإرسال')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" onClick={locate} disabled={where.state === 'finding'} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60">
                    <LocateFixed className="w-4 h-4" aria-hidden="true" /> {where.state === 'finding' ? L('Finding you…', 'جارٍ تحديد موقعك…') : L('Show where I am', 'اعرض موقعي')}
                  </button>
                  {(where.state === 'denied' || where.state === 'unavailable') && (
                    <p className="mt-2 text-xs text-red-700" role="alert">
                      {where.state === 'denied'
                        ? L('Location is turned off for this site. Allow it in your browser settings, then try again.', 'الموقع غير مسموح لهذا الموقع. اسمح به من إعدادات المتصفح ثم حاول مرة أخرى.')
                        : L("Your position couldn't be found. Try again outside, away from tall walls.", 'تعذر تحديد موقعك. حاول مرة أخرى في مكان مفتوح بعيدًا عن الجدران العالية.')}
                    </p>
                  )}
                </>
              )}
            </section>

            <section aria-labelledby="help-phrases">
              <h3 id="help-phrases" className={heading}>{L('Show in Arabic', 'عبارات بالعربية')}</h3>
              <ul className="space-y-2">
                {allPhrases.map(p => (
                  <li key={p.id}>
                    <button type="button" data-phrase={p.id} onClick={() => setShown(p)} className="w-full text-start rounded-2xl border border-sand p-3 hover:border-nile">
                      {!ar && (
                        <span className="block text-sm text-ink" lang={p.meaning?.lang}>
                          {p.meaning ? p.meaning.text : phraseMeaning(p.id)}
                        </span>
                      )}
                      <span lang="ar" dir="rtl" className="block font-arabic text-base text-stone-700">{p.ar}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="help-tips">
              <h3 id="help-tips" className={heading}>{L('Good to know', 'معلومات مفيدة')}</h3>
              <ul className="list-disc ps-5 space-y-1 text-sm text-stone-700">
                <li>{L('Carry water and rest in the shade: the sun is strong, even in winter.', 'احمل الماء واسترح في الظل: الشمس قوية حتى في الشتاء.')}</li>
                <li>{L('In mosques, cover shoulders and knees; women cover their hair. Shoes come off at the door.', 'في المساجد، غطِّ الكتفين والركبتين، وتغطي النساء شعرهن. يُخلع الحذاء عند الباب.')}</li>
                <li>{L('Keep small change for tips, toilets and the shoe keeper.', 'احتفظ بفكة للبقشيش ودورات المياه وحارس الأحذية.')}</li>
                <li>{L('Agree on a taxi fare before you set off, or use a ride-hailing app.', 'اتفق على أجرة التاكسي قبل التحرك، أو استخدم تطبيقًا لطلب السيارات.')}</li>
                {(help?.tips ?? []).map((t, i) => {
                  const text = ar ? { text: t.textAr, lang: undefined } : optionalText(t, 'text');
                  return <li key={i} lang={text.lang}>{text.text}</li>;
                })}
              </ul>
            </section>
          </div>
        )}
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
