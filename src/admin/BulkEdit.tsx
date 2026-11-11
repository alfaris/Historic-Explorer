import React, { useId, useMemo, useState } from 'react';
import { categories, type Category } from '../data/locations';
import type { Content } from '../data/content';
import type { SaveFn } from './AdminApp';
import { applyBulk, type BulkAction } from './bulk-edit';
import { Button, inputClass } from './ui';

type Kind = BulkAction['kind'];

/**
 * "Edit several places": the places ticked in the list, an action (move to a
 * route, set the category, Must-see on or off), what it will change, and Apply,
 * which saves it as one version. Nothing is saved until then.
 */
export function BulkEdit({ content, save, selected, onClear, onDone }: {
  content: Content;
  save: SaveFn;
  selected: number[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Kind>('route');
  const [routeId, setRouteId] = useState(content.routes[0]?.id ?? '');
  const [category, setCategory] = useState<Category>('monument');
  const [mustSee, setMustSee] = useState(true);
  const [busy, setBusy] = useState(false);
  const actionId = useId();
  const valueId = useId();
  const action: BulkAction = kind === 'route' ? { kind, routeId } : kind === 'category' ? { kind, category } : { kind, on: mustSee };
  // Worked out against the content as it is now, again when Apply is pressed.
  const result = useMemo(() => applyBulk(content, selected, action), [content, selected, kind, routeId, category, mustSee]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = async () => {
    const now = applyBulk(content, selected, action);
    if (!now.changed) return;
    setBusy(true);
    if (await save(now.content, now.summary)) onDone();
    setBusy(false);
  };
  const names = selected.map(id => content.places.find(p => p.id === id)?.nameEn).filter(Boolean);
  return (
    <section className="bg-white rounded-2xl border border-sand/50 p-6 space-y-4" aria-label="Edit several places">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-serif">Edit several places</h2>
        <Button type="button" variant="secondary" onClick={onDone}>Done</Button>
      </div>
      <p className="text-sm text-stone-600">
        {selected.length === 0 ? 'Tick places in the list to edit them together.' : `${selected.length} selected: ${names.slice(0, 6).join(', ')}${names.length > 6 ? `, and ${names.length - 6} more` : ''}.`}
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="ms-2 min-h-11 px-1 text-xs font-bold text-nile hover:underline">Clear</button>
        )}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={actionId} className="block text-xs font-bold text-stone-500">Action</label>
          <select id={actionId} value={kind} onChange={e => setKind(e.target.value as Kind)} className={`${inputClass} mt-1`}>
            <option value="route">Move to route…</option>
            <option value="category">Set category…</option>
            <option value="mustSee">Must-see on or off</option>
          </select>
        </div>
        <div>
          <label htmlFor={valueId} className="block text-xs font-bold text-stone-500">{kind === 'route' ? 'Route' : kind === 'category' ? 'Category' : 'Must-see'}</label>
          {kind === 'route' ? (
            <select id={valueId} value={routeId} onChange={e => setRouteId(e.target.value)} className={`${inputClass} mt-1`}>
              {content.routes.map(r => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
            </select>
          ) : kind === 'category' ? (
            <select id={valueId} value={category} onChange={e => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          ) : (
            <select id={valueId} value={mustSee ? 'on' : 'off'} onChange={e => setMustSee(e.target.value === 'on')} className={`${inputClass} mt-1`}>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          )}
        </div>
      </div>
      {selected.length > 0 && (
        <div className="rounded-xl bg-chalk border border-sand/50 p-3 text-sm" role="status">
          <p className="text-ink">{result.changed ? `${result.summary}.` : 'Nothing to change.'}</p>
          {(result.unchanged > 0 || result.notMonuments > 0) && (
            <p className="mt-1 text-xs text-stone-500">
              {[
                result.unchanged > 0 && `${result.unchanged} already like that`,
                result.notMonuments > 0 && `${result.notMonuments} not ${result.notMonuments === 1 ? 'a monument' : 'monuments'} (only monuments are stops)`,
              ].filter(Boolean).join(' · ')}{' '}
              left as they are.
            </p>
          )}
          {kind === 'route' && result.changed > 0 && <p className="mt-1 text-xs text-stone-500">They go to the end of the route's walking order; reorder them in the Routes tab.</p>}
        </div>
      )}
      <Button type="button" onClick={apply} disabled={busy || result.changed === 0}>
        {busy ? 'Saving…' : result.changed ? `Apply to ${result.changed} ${result.changed === 1 ? 'place' : 'places'}` : 'Apply'}
      </Button>
    </section>
  );
}
