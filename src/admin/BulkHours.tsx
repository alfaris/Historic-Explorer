import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import type { Content } from '../data/content';
import { categories } from '../data/locations';
import { hoursProblems, type OpeningHours } from '../lib/opening-hours';
import type { SaveFn } from './AdminApp';
import { applyHours } from './bulk-hours';
import { HoursEditor } from './HoursEditor';
import { Button, ErrorBox, inputClass } from './ui';

/**
 * The same opening hours for several places in one save (one History entry):
 * tick the places, set the hours (or copy them from a place that has some), apply.
 */
export function BulkHours({ content, save, onClose }: { content: Content; save: SaveFn; onClose: () => void }) {
  const [routeId, setRouteId] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [hours, setHours] = useState<OpeningHours | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      content.places.filter(
        p => (routeId === 'all' || p.routeId === routeId) && (category === 'all' || p.category === category) && (!onlyMissing || !p.hours || picked.has(p.id)),
      ),
    [content.places, routeId, category, onlyMissing, picked],
  );
  const withHours = content.places.filter(p => p.hours);
  const replacing = content.places.filter(p => picked.has(p.id) && p.hours);
  const problems = hours ? hoursProblems(hours) : [];
  const allShownPicked = shown.length > 0 && shown.every(p => picked.has(p.id));

  const toggle = (id: number) =>
    setPicked(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleShown = () =>
    setPicked(s => {
      const next = new Set(s);
      for (const p of shown) {
        if (allShownPicked) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });

  const apply = async () => {
    if (!hours || problems.length || picked.size === 0) return;
    if (replacing.length && !window.confirm(`${replacing.length} of these places already have hours, which will be replaced. Continue?`)) return;
    setBusy(true);
    const count = picked.size;
    if (await save({ ...content, places: applyHours(content.places, picked, hours) }, `Set opening hours for ${count} places`)) {
      setDone(`Hours set for ${count} places and saved. You can restore the previous hours from History.`);
      setPicked(new Set());
    }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-sand/50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-gold" aria-hidden="true" />
        <h2 className="text-xl font-serif flex-1">Set hours for several places</h2>
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
      </div>
      <p className="text-xs text-stone-500">Tick the places, set their hours once, and save them together as one History entry. Each place keeps its own note unless you write a new one.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={routeId} onChange={e => setRouteId(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Route">
          <option value="all">All routes</option>
          {content.routes.map(r => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Category">
          <option value="all">All kinds</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-stone-600 min-h-11">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
          Only places without hours
        </label>
      </div>

      <div className="rounded-xl border border-sand/60">
        <label className="flex items-center gap-2 px-3 py-2 border-b border-sand/60 text-xs font-bold text-stone-600">
          <input type="checkbox" checked={allShownPicked} onChange={toggleShown} disabled={shown.length === 0} />
          {allShownPicked ? 'Untick' : 'Tick'} all {shown.length} shown · {picked.size} ticked
        </label>
        <ul className="max-h-72 overflow-y-auto divide-y divide-sand/40">
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-stone-500">No places here. Every place may already have hours: untick “Only places without hours”.</li>}
          {shown.map(p => (
            <li key={p.id}>
              <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-chalk">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="flex-1 truncate">{p.nameEn}</span>
                {p.hours && <span className="text-[11px] text-amber-800">has hours</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {withHours.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          Start from the hours of
          <select
            value=""
            onChange={e => {
              const from = content.places.find(p => p.id === Number(e.target.value));
              if (from?.hours) setHours({ days: from.hours.days.map(d => d.map(r => ({ ...r }))) });
            }}
            className={`${inputClass} !w-auto`}
          >
            <option value="">Choose a place…</option>
            {withHours.map(p => <option key={p.id} value={p.id}>{p.nameEn}</option>)}
          </select>
        </label>
      )}

      <HoursEditor hours={hours} onChange={setHours} id="bulk-hours" />

      {hours && problems.length > 0 && <ErrorBox message="Before saving:" problems={problems} />}
      {replacing.length > 0 && <p className="text-xs text-amber-800">{replacing.length} ticked {replacing.length === 1 ? 'place already has' : 'places already have'} hours, which will be replaced (notes kept unless you write new ones).</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={apply} disabled={busy || !hours || problems.length > 0 || picked.size === 0}>
          {busy ? 'Saving…' : `Set hours for ${picked.size} ${picked.size === 1 ? 'place' : 'places'}`}
        </Button>
        {done && <span className="text-xs text-nile" role="status">{done}</span>}
      </div>
    </div>
  );
}
