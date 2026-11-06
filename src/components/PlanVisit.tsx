import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, CheckCircle2, Clock, MoonStar, TriangleAlert, X } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { cairoTime, dayName, formatTime, statusText, toMinutes } from '../lib/opening-hours';
import { prayerText } from '../lib/prayer-times';
import { useDialog } from '../lib/useDialog';
import {
  STAY_OPTIONS, cairoDaysBetween, cairoHHMM, cairoInstant, defaultStay, nextQuarter, suggestStart, visitPlan, type PlanFlag,
} from '../lib/visit-plan';
import { L, byLang, currentLang, nameOf, type Lang } from '../i18n/lang';
import { minutesLabel } from './WalkInfo';

const clock = (d: Date, lang: Lang) => formatTime(cairoTime(d).minutes, lang);
// Spanish says "a las 9:00" but "a la 1:00".
const esAt = (d: Date) => `${Math.floor(cairoTime(d).minutes / 60) === 1 ? 'a la' : 'a las'} ${clock(d, 'es')}`;

const startFinish = (start: Date, finish: Date, lang: Lang) => {
  const nextDay = cairoDaysBetween(start, finish) > 0
    ? ` (${L('next day', 'اليوم التالي')})`
    : '';
  return byLang({
    en: `Start ${clock(start, lang)} · finish around ${clock(finish, lang)}${nextDay}`,
    ar: `البدء ${clock(start, lang)} · الانتهاء نحو ${clock(finish, lang)}${nextDay}`,
    fr: `Départ à ${clock(start, lang)} · fin vers ${clock(finish, lang)}${nextDay}`,
    es: `Inicio ${esAt(start)} · fin hacia ${esAt(finish).replace(/^a /, '')}${nextDay}`,
  });
};

const arStops = (n: number) => (n === 1 ? 'محطة واحدة' : n === 2 ? 'محطتان' : n <= 10 ? `${n} محطات` : `${n} محطة`);

const flaggedText = (n: number) =>
  byLang({
    en: n === 1 ? "1 stop doesn't fit this time" : `${n} stops don't fit this time`,
    ar: `${arStops(n)} ${n === 2 ? 'لا تناسبان' : 'لا تناسب'} هذا الوقت`,
    fr: n === 1 ? '1 étape ne convient pas à cet horaire' : `${n} étapes ne conviennent pas à cet horaire`,
    es: n === 1 ? '1 parada no encaja con este horario' : `${n} paradas no encajan con este horario`,
  });

const suggestionText = (at: Date, flagged: number, lang: Lang) =>
  flagged === 0
    ? byLang({
        en: `Starting at ${clock(at, lang)} avoids them all.`,
        ar: `البدء ${clock(at, lang)} يتجنبها كلها.`,
        fr: `Partir à ${clock(at, lang)} les évite toutes.`,
        es: `Empezar ${esAt(at)} las evita todas.`,
      })
    : byLang({
        en: `Starting at ${clock(at, lang)} brings it down to ${flagged}.`,
        ar: `البدء ${clock(at, lang)} يقللها إلى ${flagged}.`,
        fr: `Partir à ${clock(at, lang)} en laisse ${flagged}.`,
        es: `Empezar ${esAt(at)} lo reduce a ${flagged}.`,
      });

const startAtText = (at: Date, lang: Lang) =>
  byLang({ en: `Start at ${clock(at, lang)}`, ar: `ابدأ ${clock(at, lang)}`, fr: `Partir à ${clock(at, lang)}`, es: `Empezar ${esAt(at)}` });

const stayLabel = (n: number) => byLang({ en: `${n} min`, ar: `${n} دقيقة`, fr: `${n} min`, es: `${n} min` });

function FlagLine({ flag, at, lang }: { flag: PlanFlag; at: Date; lang: Lang }) {
  if (flag.kind === 'prayer') {
    // Already paused on arrival: when visits resume. Otherwise: when the prayer is, and for how long.
    const text = flag.pause.start <= at
      ? prayerText({ state: 'now', name: flag.pause.name, until: flag.pause.end }, lang).detail
      : (({ label, detail }) => `${label}${lang === 'ar' ? '، ' : ', '}${detail}`)(prayerText({ state: 'soon', name: flag.pause.name, at: flag.pause.at }, lang));
    return (
      <span className="block text-xs leading-snug text-amber-800">
        <MoonStar className="inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle" aria-hidden="true" />
        {L('Prayer during your visit', 'صلاة أثناء زيارتك')}
        <span className="text-stone-500"> · {text}</span>
      </span>
    );
  }
  const { detail } = statusText(flag.status, lang, at);
  return (
    <span className={`block text-xs leading-snug ${flag.kind === 'closed' ? 'text-red-800' : 'text-amber-800'}`}>
      <TriangleAlert className="inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle" aria-hidden="true" />
      {flag.kind === 'closed' ? L('Closed when you get there', 'مغلق عند وصولك') : L('Closes during your visit', 'يغلق أثناء زيارتك')}
      {detail && <span className="text-stone-500"> · {detail}</span>}
    </span>
  );
}

function PlanDialog({ route, places, onClose, onOpenPlace }: {
  route: Route;
  places: Location[];
  onClose: () => void;
  onOpenPlace: (id: number) => void;
}) {
  const lang = currentLang();
  const ar = lang === 'ar';
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);
  const [now] = useState(() => new Date());
  // Rounding up just before midnight lands on tomorrow: start the day picker there too.
  const [day, setDay] = useState(() => cairoDaysBetween(now, nextQuarter(now)));
  const [time, setTime] = useState(() => cairoHHMM(nextQuarter(now)));
  const [stay, setStay] = useState<number>(() => defaultStay(places, route));

  const start = useMemo(() => cairoInstant(now, day, /^\d\d:\d\d$/.test(time) ? toMinutes(time) : 9 * 60), [now, day, time]);
  const plan = useMemo(() => visitPlan(places, route.id, start, stay), [places, route.id, start, stay]);
  const suggestion = useMemo(() => suggestStart(places, route.id, start, stay, now), [places, route.id, start, stay, now]);

  const dayLabel = (k: number) =>
    k === 0 ? L('Today', 'اليوم') : k === 1 ? L('Tomorrow', 'غدًا') : dayName(cairoTime(cairoInstant(now, k, 12 * 60)).day, lang).replace(/^./, c => c.toUpperCase());

  const field = 'block w-full min-h-11 rounded-xl border border-sand bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-nile/20';
  const label = 'block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1';

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-visit-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-sand/50 px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink"
            aria-label={L('Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
          <h2 id="plan-visit-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Plan my visit', 'خطط لزيارتك')}</h2>
          <p className="text-sm text-stone-500 mb-4">{nameOf(route)}</p>
          <div className="grid grid-cols-3 items-end gap-2">
            <label>
              <span className={label}>{L('Day', 'يوم الزيارة')}</span>
              <select value={day} onChange={e => setDay(Number(e.target.value))} className={field}>
                {Array.from({ length: 7 }, (_, k) => <option key={k} value={k}>{dayLabel(k)}</option>)}
              </select>
            </label>
            <label>
              <span className={label}>{L('Start time', 'وقت البدء')}</span>
              <input type="time" step={900} value={time} onChange={e => setTime(e.target.value)} className={field} />
            </label>
            <label>
              <span className={label}>{L('Time at each stop', 'الوقت في كل محطة')}</span>
              <select value={stay} onChange={e => setStay(Number(e.target.value))} className={field}>
                {STAY_OPTIONS.map(n => <option key={n} value={n}>{stayLabel(n)}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="px-5 py-4">
          <div aria-live="polite" className="mb-4 space-y-2">
            {plan.finish && (
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Clock className="w-4 h-4 shrink-0 text-gold" aria-hidden="true" />
                {startFinish(start, plan.finish, lang)}
              </p>
            )}
            {plan.flagged === 0 ? (
              <p className="flex items-center gap-2 text-sm text-nile">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {L('No closures or prayer pauses on the way.', 'لا إغلاق ولا توقف للصلاة في الطريق.')}
              </p>
            ) : (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm">
                <p className="font-bold text-amber-900">{flaggedText(plan.flagged)}</p>
                {suggestion && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-700">
                    <span>{suggestionText(suggestion.start, suggestion.flagged, lang)}</span>
                    <button
                      onClick={() => setTime(cairoHHMM(suggestion.start))}
                      className="min-h-11 px-3 rounded-xl bg-white border border-amber-300 text-xs font-bold uppercase tracking-widest text-ink hover:border-nile"
                    >
                      {startAtText(suggestion.start, lang)}
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          <ol className="divide-y divide-sand/40">
            {plan.stops.map(stop => (
              <li key={stop.place.id} className="py-2">
                {stop.walkMinutes > 0 && <span className="block text-xs text-stone-400 ps-[5.25rem] pb-1">{minutesLabel(stop.walkMinutes)}</span>}
                <button
                  onClick={() => {
                    onClose();
                    onOpenPlace(stop.place.id);
                  }}
                  className="flex w-full min-h-11 items-start gap-3 text-start rounded-xl hover:bg-chalk/60 px-1 py-1"
                >
                  <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-ink">{clock(stop.arrive, lang)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      <span className="text-stone-400 tabular-nums">{stop.number}. </span>
                      {nameOf(stop.place)}
                    </span>
                    {stop.flags.map((flag, i) => <FlagLine key={i} flag={flag} at={stop.arrive} lang={lang} />)}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs text-stone-500">
            {L('Estimates. Walking times are from the map; opening hours and prayer times are in Cairo time.', 'تقديرات. أوقات المشي من الخريطة، ومواعيد العمل وأوقات الصلاة بتوقيت القاهرة.')}
          </p>
        </div>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}

/**
 * "Plan my visit": a timetable for the route's stops from a chosen day and
 * start time, flagging closures and prayer pauses, with a better start time
 * when there is one. Works offline.
 */
export function PlanVisit({ route, places, onOpenPlace, compactOnPhone = false }: {
  route: Route;
  places: Location[];
  onOpenPlace: (id: number) => void;
  compactOnPhone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex items-center justify-center gap-2 min-h-12 py-3.5 rounded-2xl bg-white border border-sand text-ink text-xs font-bold uppercase tracking-widest shadow-sm hover:border-nile transition-colors ${compactOnPhone ? 'min-w-12 px-3.5 sm:px-5' : 'px-5'}`}
      >
        <CalendarClock className="w-4 h-4 text-stone-500" aria-hidden="true" />
        <span className={compactOnPhone ? 'sr-only sm:not-sr-only' : undefined}>{L('Plan my visit', 'خطط لزيارتك')}</span>
      </button>
      {open && <PlanDialog route={route} places={places} onClose={() => setOpen(false)} onOpenPlace={onOpenPlace} />}
    </>
  );
}
