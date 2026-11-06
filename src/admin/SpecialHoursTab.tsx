import React, { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import type { Content } from '../data/content';
import type { OpeningHours } from '../lib/opening-hours';
import { periodProblems, type PeriodEntry, type SpecialPeriod } from '../lib/special-hours';
import { LANGS, LANGUAGES } from '../i18n/lang';
import type { SaveFn } from './AdminApp';
import { HoursEditor } from './HoursEditor';
import { Button, ErrorBox, Field, inputClass, sameValue } from './ui';

const blank = (): SpecialPeriod => ({ id: '', nameEn: '', nameAr: '', from: '', to: '', places: {} });
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DEFAULT_DAYS = () => Array.from({ length: 7 }, () => [{ open: '09:00', close: '17:00' }]);
const formatRange = (p: SpecialPeriod) => (p.from === p.to ? p.from : `${p.from} to ${p.to}`);

type Mode = 'usual' | 'closed' | 'hours';
const modeOf = (entry: PeriodEntry | undefined): Mode => (!entry ? 'usual' : 'closed' in entry ? 'closed' : 'hours');

/**
 * Ramadan, Eid and one-off closures: date ranges in which chosen places keep
 * different hours or are closed. On those dates the app uses them wherever it
 * uses hours; other places keep their usual hours, with a note that they may differ.
 */
export function SpecialHoursTab({ content, save }: { content: Content; save: SaveFn }) {
  const periods = content.specialPeriods ?? [];
  const [draft, setDraft] = useState<SpecialPeriod | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState(content.routes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const open = (p: SpecialPeriod | null) => {
    setDraft(p ? structuredClone(p) : blank());
    setOriginalId(p ? p.id : null);
  };

  const final = draft && { ...draft, id: draft.id || slug(`${draft.nameEn} ${draft.from.slice(0, 4)}`) };
  const original = originalId ? periods.find(p => p.id === originalId) : undefined;
  const changed = final && (!original || !sameValue(original, final));
  const placeIds = new Set(content.places.map(p => p.id));
  const problems = final ? periodProblems([final], placeIds) : [];
  if (final && !original && periods.some(p => p.id === final.id)) problems.push(`A period with the ID "${final.id}" already exists.`);

  const set = (key: keyof SpecialPeriod, value: string) =>
    setDraft(d => {
      if (!d) return d;
      const next = { ...d } as Record<string, unknown>;
      if (value.trim() || !(key === 'nameFr' || key === 'nameEs')) next[key] = value;
      else delete next[key];
      return next as unknown as SpecialPeriod;
    });
  const setEntry = (placeId: number, entry: PeriodEntry | null) =>
    setDraft(d => {
      if (!d) return d;
      const places = { ...d.places };
      if (entry) places[placeId] = entry;
      else delete places[placeId];
      return { ...d, places };
    });

  const submit = async () => {
    if (!final) return;
    setBusy(true);
    const list = original ? periods.map(p => (p.id === original.id ? final : p)) : [...periods, final];
    list.sort((a, b) => a.from.localeCompare(b.from));
    if (await save({ ...content, specialPeriods: list }, `${original ? 'Edited' : 'Added'} special hours "${final.nameEn}"`)) open(final);
    setBusy(false);
  };

  const remove = async () => {
    if (!original) return setDraft(null);
    if (!window.confirm(`Delete the special hours "${original.nameEn}"? You can restore them from History.`)) return;
    setBusy(true);
    if (await save({ ...content, specialPeriods: periods.filter(p => p.id !== original.id) }, `Deleted special hours "${original.nameEn}"`)) setDraft(null);
    setBusy(false);
  };

  const changedCount = final ? Object.keys(final.places).length : 0;
  const routePlaces = content.places.filter(p => p.routeId === routeId);

  return (
    <section className="grid md:grid-cols-[18rem_1fr] gap-6 items-start">
      <div className="bg-white rounded-2xl border border-sand/50 p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{periods.length} periods</p>
          <Button variant="secondary" onClick={() => open(null)} className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        {periods.length === 0 ? (
          <p className="px-1 pb-2 text-xs text-stone-500">None yet. Add Ramadan, Eid or a closure.</p>
        ) : (
          <ul className="divide-y divide-sand/40">
            {periods.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => open(p)}
                  className={`w-full min-h-11 px-2 py-2 text-start text-sm rounded-lg ${originalId === p.id && draft ? 'bg-nile/10 text-nile font-bold' : 'hover:bg-chalk'}`}
                >
                  <span className="block">{p.nameEn}</span>
                  <span className="block text-xs text-stone-600 font-normal">{formatRange(p)} · {Object.keys(p.places).length} places</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!draft ? (
        <p className="flex items-start gap-2 text-sm text-stone-500 py-6">
          <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
          Pick a period to edit, or add one. On its dates, the places you change use these hours (or are closed) everywhere in the app; the others keep their usual hours with a note that they may differ.
        </p>
      ) : (
        <form
          className="bg-white rounded-2xl border border-sand/50 p-5 space-y-5"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {LANGS.map(lang => {
              const key = `name${LANGUAGES[lang].suffix}` as 'nameEn';
              return (
                <Field key={lang} label={`Name (${LANGUAGES[lang].english})${lang === 'en' || lang === 'ar' ? '' : ' (optional)'}`} hint={lang === 'en' ? 'e.g. Ramadan, Eid al-Fitr, Closed for restoration' : undefined}>
                  <input className={inputClass} lang={lang} dir={LANGUAGES[lang].dir} value={draft[key] ?? ''} onChange={e => set(key, e.target.value)} maxLength={60} />
                </Field>
              );
            })}
            <Field label="First day" hint="Cairo date.">
              <input type="date" className={inputClass} value={draft.from} onChange={e => set('from', e.target.value)} />
            </Field>
            <Field label="Last day" hint="For a one-day closure, the same date.">
              <input type="date" className={inputClass} value={draft.to} min={draft.from || undefined} onChange={e => set('to', e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold text-stone-500 flex-1">Places ({changedCount} changed)</p>
              <select value={routeId} onChange={e => setRouteId(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Route">
                {content.routes.map(r => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
              </select>
            </div>
            <ul className="divide-y divide-sand/40 rounded-xl border border-sand/50">
              {routePlaces.map(place => {
                const entry = draft.places[String(place.id)];
                const mode = modeOf(entry);
                return (
                  <li key={place.id} className="p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex-1 min-w-0 text-sm">
                        {place.nameEn}
                        {!place.hours && <span className="block text-xs text-stone-600">No usual hours</span>}
                      </span>
                      <select
                        value={mode}
                        onChange={e => {
                          const m = e.target.value as Mode;
                          setEntry(place.id, m === 'usual' ? null : m === 'closed' ? { closed: true } : { days: place.hours ? structuredClone(place.hours.days) : DEFAULT_DAYS() });
                        }}
                        className={`${inputClass} !w-auto`}
                        aria-label={`${place.nameEn} during this period`}
                      >
                        <option value="usual">Usual hours</option>
                        <option value="closed">Closed</option>
                        <option value="hours">Different hours</option>
                      </select>
                    </div>
                    {entry && 'days' in entry && (
                      <HoursEditor
                        id={`period-hours-${place.id}`}
                        label="Hours during this period"
                        showNote={false}
                        hours={{ days: entry.days }}
                        onChange={(h: OpeningHours | undefined) => setEntry(place.id, h ? { days: h.days } : null)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {problems.length > 0 && changed && <ErrorBox message="Before saving:" problems={problems} />}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !changed || problems.length > 0}>{original ? 'Save period' : 'Add period'}</Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Close</Button>
            <Button type="button" variant="danger" onClick={remove} disabled={busy} className="ms-auto">{original ? 'Delete' : 'Discard'}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
