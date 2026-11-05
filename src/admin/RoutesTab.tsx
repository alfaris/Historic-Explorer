import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import type { Content, Route } from '../data/content';
import type { SaveFn } from './AdminApp';
import { Button, Field, inputClass } from './ui';
import { PhotoField } from './PhotoField';
import { builtInPhoto } from '../data/photo-resolve';
import { applyStopOrder, walkPlan, walkStops } from '../lib/walk';

const blankRoute = (): Route => ({
  id: '',
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  image: '',
  highlightsEn: [],
  highlightsAr: [],
  distance: '',
  duration: '',
});

export function RoutesTab({ content, save }: { content: Content; save: SaveFn }) {
  const [draft, setDraft] = useState<Route | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  // Highlights are edited as raw text (one per line) and split only when saving,
  // so spaces and new lines aren't trimmed away while typing.
  const [highlights, setHighlights] = useState({ en: '', ar: '' });
  // The stops' walking order, as place IDs. Applied to the places when saving.
  const [order, setOrder] = useState<number[]>([]);

  const lines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
  const open = (route: Route, asNew: boolean) => {
    setDraft({ ...route, highlightsEn: [...route.highlightsEn], highlightsAr: [...route.highlightsAr] });
    setHighlights({ en: route.highlightsEn.join('\n'), ar: route.highlightsAr.join('\n') });
    setOrder(asNew ? [] : walkStops(content.places, route.id).map(p => p.id));
    setIsNew(asNew);
  };
  const finalDraft = draft && { ...draft, highlightsEn: lines(highlights.en), highlightsAr: lines(highlights.ar) };

  const original = draft && !isNew ? content.routes.find(r => r.id === draft.id) : undefined;
  const savedOrder = draft && !isNew ? walkStops(content.places, draft.id).map(p => p.id) : [];
  const orderChanged = order.join() !== savedOrder.join();
  const changed = finalDraft && (isNew || orderChanged || JSON.stringify(original) !== JSON.stringify(finalDraft));
  // Walking times for the order being edited, so the effect of a move shows straight away.
  const orderedPlaces = draft && !isNew ? applyStopOrder(content.places, draft.id, order) : [];
  const plan = draft && !isNew ? walkPlan(orderedPlaces, draft.id) : new Map();
  const move = (index: number, by: -1 | 1) =>
    setOrder(o => {
      const next = [...o];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const placeCount = (id: string) => content.places.filter(p => p.routeId === id).length;

  const set = <K extends keyof Route>(key: K, value: Route[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));

  const submit = async () => {
    if (!finalDraft) return;
    setBusy(true);
    const next: Content = isNew
      ? { ...content, routes: [...content.routes, finalDraft] }
      : {
          ...content,
          routes: content.routes.map(r => (r.id === finalDraft.id ? finalDraft : r)),
          places: applyStopOrder(content.places, finalDraft.id, order),
        };
    const detailsChanged = isNew || JSON.stringify(original) !== JSON.stringify(finalDraft);
    const message = isNew
      ? `Added route "${finalDraft.nameEn}"`
      : !detailsChanged
        ? `Reordered the stops of "${finalDraft.nameEn}"`
        : `Edited route "${finalDraft.nameEn}"${orderChanged ? ' and its stop order' : ''}`;
    if (await save(next, message)) setIsNew(false);
    setBusy(false);
  };

  const remove = async () => {
    if (!draft) return;
    if (isNew) return setDraft(null);
    if (!window.confirm(`Delete the route "${draft.nameEn}"? You can restore it from History.`)) return;
    setBusy(true);
    if (await save({ ...content, routes: content.routes.filter(r => r.id !== draft.id) }, `Deleted route "${draft.nameEn}"`)) setDraft(null);
    setBusy(false);
  };

  return (
    <section className="grid md:grid-cols-[320px_1fr] gap-6 items-start">
      <div className="bg-white rounded-2xl border border-sand/50 p-4">
        <Button
          onClick={() => open(blankRoute(), true)}
          className="w-full mb-3 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add route
        </Button>
        <ul className="-mx-2">
          {content.routes.map(r => (
            <li key={r.id}>
              <button
                onClick={() => open(r, false)}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm ${draft?.id === r.id && !isNew ? 'bg-nile/10 text-nile' : 'hover:bg-chalk'}`}
              >
                <span className="block">{r.nameEn}</span>
                <span className="block text-[11px] text-stone-400">{placeCount(r.id)} places</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!draft ? (
        <p className="text-stone-500 bg-white rounded-2xl border border-sand/50 p-8 text-center">Choose a route to edit, or add a new one.</p>
      ) : (
        <form
          className="bg-white rounded-2xl border border-sand/50 p-6 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 className="text-xl font-serif">{isNew ? 'New route' : draft.nameEn}</h2>
          <Field label="ID" hint={isNew ? 'Lowercase letters, numbers and dashes, e.g. "islamic-cairo". Can’t be changed later.' : 'IDs can’t be changed.'}>
            <input value={draft.id} onChange={e => set('id', e.target.value.toLowerCase())} className={inputClass} disabled={!isNew} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name (English)">
              <input value={draft.nameEn} onChange={e => set('nameEn', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Name (Arabic)">
              <input value={draft.nameAr} onChange={e => set('nameAr', e.target.value)} className={inputClass} dir="rtl" />
            </Field>
            <Field label="Description (English)">
              <textarea value={draft.descriptionEn} onChange={e => set('descriptionEn', e.target.value)} className={inputClass} rows={3} />
            </Field>
            <Field label="Description (Arabic)">
              <textarea value={draft.descriptionAr} onChange={e => set('descriptionAr', e.target.value)} className={inputClass} rows={3} dir="rtl" />
            </Field>
            <Field label="Highlights (English)" hint="One per line, up to 8.">
              <textarea value={highlights.en} onChange={e => setHighlights(h => ({ ...h, en: e.target.value }))} className={inputClass} rows={3} />
            </Field>
            <Field label="Highlights (Arabic)" hint="Same number of lines as English.">
              <textarea value={highlights.ar} onChange={e => setHighlights(h => ({ ...h, ar: e.target.value }))} className={inputClass} rows={3} dir="rtl" />
            </Field>
            <Field label="Distance" hint='e.g. "2.5 km"'>
              <input value={draft.distance} onChange={e => set('distance', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Duration" hint='e.g. "2-3 hours"'>
              <input value={draft.duration} onChange={e => set('duration', e.target.value)} className={inputClass} />
            </Field>
          </div>
          <PhotoField
            photo={draft.photo}
            builtIn={draft.id ? builtInPhoto(`route-${draft.id}`) : undefined}
            onChange={photo => setDraft(d => {
              if (!d) return d;
              const { photo: _old, ...rest } = d;
              return photo ? { ...rest, photo } : rest;
            })}
          />
          {!isNew && order.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-600 mb-1">Walking order</p>
              <p className="text-[11px] text-stone-400 mb-2">
                The route's monuments, in the order visitors walk them. The app shows "Next stop" and the walking time from this order, and draws the route line on the map in it.
              </p>
              <ol className="rounded-xl border border-sand/60 divide-y divide-sand/40">
                {order.map((id, i) => {
                  const place = content.places.find(p => p.id === id);
                  const leg = plan.get(id)?.leg;
                  return (
                    <li key={id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-6 text-end text-stone-400 tabular-nums">{i + 1}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{place?.nameEn}</span>
                        {leg && <span className="block text-[11px] text-stone-400">then about {leg.minutes} min walk to the next stop</span>}
                      </span>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-stone-500 hover:bg-chalk disabled:opacity-30" aria-label={`Move ${place?.nameEn} up`}>
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="p-1.5 rounded-lg text-stone-500 hover:bg-chalk disabled:opacity-30" aria-label={`Move ${place?.nameEn} down`}>
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[11px] text-stone-400 mt-1">Cafés, shops and meeting points aren't stops; they're shown as nearby extras.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={busy || !changed}>
              {busy ? 'Saving…' : isNew ? 'Add route' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={remove}
              disabled={busy || (!isNew && placeCount(draft.id) > 0)}
              title={!isNew && placeCount(draft.id) > 0 ? 'Move or delete its places first' : undefined}
              className="ms-auto"
            >
              {isNew ? 'Cancel' : 'Delete route'}
            </Button>
          </div>
          {!isNew && placeCount(draft.id) > 0 && <p className="text-[11px] text-stone-400 text-end">To delete this route, move or delete its {placeCount(draft.id)} places first.</p>}
        </form>
      )}
    </section>
  );
}
