import React from 'react';
import { Footprints, Flag } from 'lucide-react';
import type { Location } from '../data/locations';
import { formatDistance } from '../lib/geo';
import type { StopInfo } from '../lib/walk';
import { ArrivalWarning } from './PlaceHours';

import { L, byLang, nameOf } from '../i18n/lang';
export const minutesLabel = (n: number) =>
  byLang({ en: `${n} min walk`, ar: `${n} ${n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : n <= 10 ? 'دقائق' : 'دقيقة'} سيرًا`, fr: `${n} min à pied`, es: `${n} min a pie` });
export const stopOfLabel = (number: number, total: number) =>
  byLang({ en: `Stop ${number} of ${total}`, ar: `المحطة ${number} من ${total}`, fr: `Étape ${number} sur ${total}`, es: `Parada ${number} de ${total}` });

/** "Stop 3 of 12", shown above a stop's name. */
export function StopNumber({ info, isArabic }: { info: StopInfo<Location>; isArabic: boolean }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
      {stopOfLabel(info.number, info.total)}
    </span>
  );
}

/** "Next: Sarghatmish Mosque · 4 min walk · 290 m". Opens the next stop. */
export function NextStop({ info, isArabic, onOpen }: {
  info: StopInfo<Location>;
  isArabic: boolean;
  onOpen: (id: number) => void;
}) {
  if (!info.leg) {
    return (
      <p className="flex items-center gap-2 text-xs text-stone-400">
        <Flag className="w-3.5 h-3.5" />
        {L('Last stop on this route', 'آخر محطة في هذا المسار')}
      </p>
    );
  }
  const { next, minutes, meters } = info.leg;
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        onOpen(next.id);
      }}
      className="group/next flex w-full items-center gap-3 rounded-xl border border-sand/50 bg-chalk/60 px-4 py-3 text-start transition-colors hover:border-nile/40 hover:bg-nile/5"
    >
      <Footprints className="w-4 h-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
          {L('Next stop', 'المحطة التالية')}
        </span>
        <span className="block truncate text-sm text-ink group-hover/next:text-nile">{nameOf(next)}</span>
        <ArrivalWarning place={next} minutes={minutes} className="mt-1" />
      </span>
      <span className="shrink-0 text-end text-xs text-stone-500">
        <span className="block font-bold">{minutesLabel(minutes)}</span>
        <span className="block text-[11px] text-stone-400">{formatDistance(meters, isArabic)}</span>
      </span>
    </button>
  );
}
