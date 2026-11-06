import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, Ticket, TriangleAlert } from 'lucide-react';
import type { Location } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { cairoTime, openStatus, statusText, weekRows } from '../lib/opening-hours';
import { effectiveHours, periodName, type SpecialPeriod } from '../lib/special-hours';
import { L, byLang, currentLang, optionalText } from '../i18n/lang';

/** The current time, refreshed every minute so "Open now" stays true. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const tone = (open: boolean, soon: boolean) => (open ? (soon ? 'text-amber-800' : 'text-nile') : 'text-red-800');
const dot = (open: boolean, soon: boolean) => (open ? (soon ? 'bg-amber-500' : 'bg-nile-light') : 'bg-red-600');

/** The place's hours in force at `at`, with the special periods (Ramadan, Eid…) applied. */
export function useEffectiveHours(place: Location, at: Date) {
  const { specialPeriods } = useContent();
  return effectiveHours(place, at, specialPeriods);
}

/** "Ramadan", marking hours that come from a special period. */
function PeriodTag({ period }: { period: SpecialPeriod }) {
  const name = periodName(period, currentLang());
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold-ink">
      <CalendarDays className="w-3 h-3" aria-hidden="true" />
      <span className="sr-only">{L('Special hours', 'مواعيد خاصة')}: </span>
      <span lang={name.lang}>{name.text}</span>
    </span>
  );
}

/** "● Open now · closes 5 pm", with "Ramadan" when special hours apply. Nothing when the place has no hours. */
export function HoursBadge({ place, className = '' }: { place: Location; className?: string }) {
  const now = useNow();
  const eff = useEffectiveHours(place, now);
  const status = openStatus(eff.hours, now);
  if (!status) return null;
  const text = statusText(status, currentLang(), now);
  const label = eff.closedToday ? L('Closed today', 'مغلق اليوم') : text.label;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot(status.open, text.soon)}`} aria-hidden="true" />
      <span className={`font-bold ${tone(status.open, text.soon)}`}>{label}</span>
      {text.detail && <span className="text-stone-500">· {text.detail}</span>}
      {eff.period && <PeriodTag period={eff.period} />}
    </span>
  );
}

/** Status, the week's hours, the note and the entry fee. Nothing when the place has none of them. */
export function PlaceHours({ place }: { place: Location }) {
  const lang = currentLang();
  const now = useNow();
  const today = cairoTime(now).day;
  const fee = optionalText(place, 'fee');
  const eff = useEffectiveHours(place, now);
  const hours = eff.hours;
  if (!hours && !fee.text) return null;
  const mayDiffer = eff.mayDiffer && periodName(eff.mayDiffer, lang).text;
  const note = hours ? optionalText(hours, 'note') : { text: '', lang: undefined };
  return (
    <div className="mb-6 rounded-2xl border border-sand/60 bg-chalk/50 p-4 space-y-3 text-sm">
      {hours && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <Clock className="w-4 h-4 shrink-0 text-gold" aria-hidden="true" />
            {/* The status itself sits under the place's name (HoursBadge). */}
            <span className="flex-1 font-bold text-stone-600">
              {L('Opening hours', 'مواعيد العمل')}
              {eff.period && <span className="ms-2 align-middle"><PeriodTag period={eff.period} /></span>}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-nile underline-offset-4 group-open:hidden">{L('Show', 'عرض')}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-nile underline-offset-4 hidden group-open:inline">{L('Hide', 'إخفاء')}</span>
          </summary>
          <table className="mt-3 w-full text-xs">
            <caption className="sr-only">{L('Opening hours', 'مواعيد العمل')}</caption>
            <tbody>
              {weekRows(hours, lang).map(row => (
                <tr key={row.day} className={row.day === today ? 'font-bold text-ink' : 'text-stone-600'}>
                  <th scope="row" className="py-0.5 pe-4 text-start font-normal">{row.name}</th>
                  <td className="py-0.5 text-end tabular-nums">{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-stone-500">{L('Cairo time. Hours can change on holidays and during Ramadan.', 'بتوقيت القاهرة. قد تتغير المواعيد في الأعياد وشهر رمضان.')}</p>
        </details>
      )}
      {mayDiffer && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <CalendarDays className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {byLang({
            en: `${mayDiffer}: these hours may differ.`,
            ar: `${mayDiffer}: قد تختلف هذه المواعيد.`,
            fr: `${mayDiffer} : ces horaires peuvent changer.`,
            es: `${mayDiffer}: este horario puede cambiar.`,
          })}
        </p>
      )}
      {note.text && <p className="text-xs text-stone-600" lang={note.lang}>{note.text}</p>}
      {fee.text && (
        <p className="flex items-center gap-2 text-xs text-stone-600">
          <Ticket className="w-4 h-4 shrink-0 text-gold" aria-hidden="true" />
          <span>
            <span className="font-bold">{L('Entry', 'الدخول')}:</span> <span lang={fee.lang}>{fee.text}</span>
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * "Likely closed when you get there · opens 9 am", for the next stop, when
 * the walking time takes the visitor past closing time. Nothing otherwise.
 */
export function ArrivalWarning({ place, minutes, className = '' }: { place: Location; minutes: number; className?: string }) {
  const now = useNow();
  const arrival = new Date(now.getTime() + minutes * 60_000);
  // The hours in force on the day of arrival.
  const { specialPeriods } = useContent();
  const status = openStatus(effectiveHours(place, arrival, specialPeriods).hours, arrival);
  if (!status || status.open) return null;
  const { detail } = statusText(status, currentLang(), arrival);
  return (
    <span className={`block text-xs leading-snug text-amber-800 ${className}`}>
      <TriangleAlert className="inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle" aria-hidden="true" />
      {L('Likely closed when you get there', 'غالبًا سيكون مغلقًا عند وصولك')}
      {detail && <span className="text-stone-500"> · {detail}</span>}
    </span>
  );
}
