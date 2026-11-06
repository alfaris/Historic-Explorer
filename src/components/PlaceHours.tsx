import React, { useEffect, useState } from 'react';
import { Clock, Ticket, TriangleAlert } from 'lucide-react';
import type { Location } from '../data/locations';
import { cairoTime, closedOnArrival, openStatus, statusText, weekRows } from '../lib/opening-hours';
import { L, currentLang, optionalText } from '../i18n/lang';

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

/** "● Open now · closes 5 pm". Nothing when the place has no hours. */
export function HoursBadge({ place, className = '' }: { place: Location; className?: string }) {
  const now = useNow();
  const status = openStatus(place.hours, now);
  if (!status) return null;
  const { label, detail, soon } = statusText(status, currentLang(), now);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot(status.open, soon)}`} aria-hidden="true" />
      <span className={`font-bold ${tone(status.open, soon)}`}>{label}</span>
      {detail && <span className="text-stone-500">· {detail}</span>}
    </span>
  );
}

/** Status, the week's hours, the note and the entry fee. Nothing when the place has none of them. */
export function PlaceHours({ place }: { place: Location }) {
  const lang = currentLang();
  const today = cairoTime(useNow()).day;
  const fee = optionalText(place, 'fee');
  const hours = place.hours;
  if (!hours && !fee.text) return null;
  const note = hours ? optionalText(hours, 'note') : { text: '', lang: undefined };
  return (
    <div className="mb-6 rounded-2xl border border-sand/60 bg-chalk/50 p-4 space-y-3 text-sm">
      {hours && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <Clock className="w-4 h-4 shrink-0 text-gold" aria-hidden="true" />
            {/* The status itself sits under the place's name (HoursBadge). */}
            <span className="flex-1 font-bold text-stone-600">{L('Opening hours', 'مواعيد العمل')}</span>
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
  if (!closedOnArrival(place.hours, minutes, now)) return null;
  const arrival = new Date(now.getTime() + minutes * 60_000);
  const { detail } = statusText(openStatus(place.hours, arrival)!, currentLang(), arrival);
  return (
    <span className={`block text-xs leading-snug text-amber-800 ${className}`}>
      <TriangleAlert className="inline w-3.5 h-3.5 me-1 -mt-0.5 align-middle" aria-hidden="true" />
      {L('Likely closed when you get there', 'غالبًا سيكون مغلقًا عند وصولك')}
      {detail && <span className="text-stone-500"> · {detail}</span>}
    </span>
  );
}
