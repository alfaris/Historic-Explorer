import React from 'react';
import { Copy, Plus, X } from 'lucide-react';
import type { OpeningHours, TimeRange } from '../lib/opening-hours';
import { hoursProblems } from '../lib/opening-hours';
import { Field, inputClass } from './ui';
import { withOptional } from './french';

// Monday first, as most admins think of the week. Index = Date.getDay().
const ROWS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
const DEFAULT_RANGE: TimeRange = { open: '09:00', close: '17:00' };

/**
 * Weekly opening hours for a place: time ranges per day (none = closed that
 * day), a note in three languages, or no hours at all.
 */
export function HoursEditor({ hours, onChange }: { hours: OpeningHours | undefined; onChange: (hours: OpeningHours | undefined) => void }) {
  const setDay = (day: number, ranges: TimeRange[]) => hours && onChange({ ...hours, days: hours.days.map((d, i) => (i === day ? ranges : d)) });
  const problems = hours ? hoursProblems(hours) : [];

  return (
    <div id="hours" className="rounded-xl border border-sand/60 p-4 space-y-3 scroll-mt-24">
      <label className="flex items-center gap-2 text-sm font-bold text-stone-600">
        <input
          type="checkbox"
          checked={!!hours}
          onChange={e => onChange(e.target.checked ? { days: Array.from({ length: 7 }, () => [{ ...DEFAULT_RANGE }]) } : undefined)}
        />
        Opening hours
      </label>
      {!hours ? (
        <p className="text-[11px] text-stone-400">No hours: visitors see nothing about opening times. Tick to add them (Cairo time).</p>
      ) : (
        <>
          <p className="text-[11px] text-stone-400">Cairo time. A day with no times is closed. A range that ends after midnight (e.g. 18:00 to 02:00) is fine.</p>
          <ul className="space-y-2">
            {ROWS.map(([day, name]) => {
              const ranges = hours.days[day];
              return (
                <li key={day} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 text-stone-600">{name}</span>
                  {ranges.length === 0 && <span className="text-stone-400 text-xs">Closed</span>}
                  {ranges.map((r, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <input
                        type="time"
                        value={r.open}
                        onChange={e => setDay(day, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
                        className={`${inputClass} !w-28 !p-1.5`}
                        aria-label={`${name} opens`}
                      />
                      <span className="text-stone-400">–</span>
                      <input
                        type="time"
                        value={r.close}
                        onChange={e => setDay(day, ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
                        className={`${inputClass} !w-28 !p-1.5`}
                        aria-label={`${name} closes`}
                      />
                      <button type="button" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} className="p-1 text-stone-400 hover:text-red-700" aria-label={`Remove ${name} ${r.open}–${r.close}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                  {ranges.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setDay(day, [...ranges, ranges.length ? { open: '', close: '' } : { ...DEFAULT_RANGE }])}
                      className="flex items-center gap-1 text-xs text-nile hover:underline"
                      aria-label={`Add a time range on ${name}`}
                    >
                      <Plus className="w-3.5 h-3.5" /> {ranges.length ? 'Add' : 'Open'}
                    </button>
                  )}
                  {day === 1 && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...hours, days: hours.days.map(() => ranges.map(r => ({ ...r }))) })}
                      className="ms-auto flex items-center gap-1 text-xs text-stone-500 hover:text-nile"
                    >
                      <Copy className="w-3.5 h-3.5" /> Same every day
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Note (English)" hint='Optional, e.g. "Closed for Friday prayers 11:30–13:30"'>
              <input value={hours.noteEn ?? ''} onChange={e => onChange(withOptional(hours, 'noteEn', e.target.value))} className={inputClass} maxLength={200} />
            </Field>
            <Field label="Note (Arabic)">
              <input value={hours.noteAr ?? ''} onChange={e => onChange(withOptional(hours, 'noteAr', e.target.value))} className={inputClass} dir="rtl" maxLength={200} />
            </Field>
            <Field label="Note (French)">
              <input value={hours.noteFr ?? ''} onChange={e => onChange(withOptional(hours, 'noteFr', e.target.value))} className={inputClass} lang="fr" maxLength={200} />
            </Field>
          </div>
          {problems.length > 0 && (
            <ul className="text-xs text-red-700 list-disc ps-5" role="alert">
              {problems.map(p => <li key={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
