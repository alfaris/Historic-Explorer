import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Content, Route } from '../data/content';
import type { SaveFn } from './AdminApp';
import { Button, Field, inputClass } from './ui';

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

  const original = draft && !isNew ? content.routes.find(r => r.id === draft.id) : undefined;
  const changed = draft && (isNew || JSON.stringify(original) !== JSON.stringify(draft));
  const placeCount = (id: string) => content.places.filter(p => p.routeId === id).length;

  const set = <K extends keyof Route>(key: K, value: Route[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));
  const lines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    const next: Content = isNew
      ? { ...content, routes: [...content.routes, draft] }
      : { ...content, routes: content.routes.map(r => (r.id === draft.id ? draft : r)) };
    if (await save(next, isNew ? `Added route "${draft.nameEn}"` : `Edited route "${draft.nameEn}"`)) setIsNew(false);
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
          onClick={() => {
            setDraft(blankRoute());
            setIsNew(true);
          }}
          className="w-full mb-3 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add route
        </Button>
        <ul className="-mx-2">
          {content.routes.map(r => (
            <li key={r.id}>
              <button
                onClick={() => {
                  setDraft({ ...r, highlightsEn: [...r.highlightsEn], highlightsAr: [...r.highlightsAr] });
                  setIsNew(false);
                }}
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
              <textarea value={draft.highlightsEn.join('\n')} onChange={e => set('highlightsEn', lines(e.target.value))} className={inputClass} rows={3} />
            </Field>
            <Field label="Highlights (Arabic)" hint="Same number of lines as English.">
              <textarea value={draft.highlightsAr.join('\n')} onChange={e => set('highlightsAr', lines(e.target.value))} className={inputClass} rows={3} dir="rtl" />
            </Field>
            <Field label="Distance" hint='e.g. "2.5 km"'>
              <input value={draft.distance} onChange={e => set('distance', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Duration" hint='e.g. "2-3 hours"'>
              <input value={draft.duration} onChange={e => set('duration', e.target.value)} className={inputClass} />
            </Field>
          </div>
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
