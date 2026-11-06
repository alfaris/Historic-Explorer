import React, { useEffect, useMemo, useState } from 'react';
import { Languages, Plus, Search } from 'lucide-react';
import { categories } from '../data/locations';
import { nextPlaceId, type Content, type Location } from '../data/content';
import type { SaveFn } from './AdminApp';
import { Button, Field, inputClass, MapPicker, sameValue } from './ui';
import { PhotoField } from './PhotoField';
import { builtInPhoto } from '../data/photo-resolve';
import { descriptionOf, LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang, type OptionalLang } from '../i18n/lang';
import { api } from './api';
import { AudioPanel } from './AudioPanel';
import { HoursEditor } from './HoursEditor';
import { fieldKey, FillMissingButton, missingPlaceText, withOptional } from './translations';

const CAIRO_CENTRE = { lat: 30.0444, lng: 31.2357 };

export function PlacesTab({ content, save, initialPlaceId, initialSection = null, onSelected }: {
  content: Content;
  save: SaveFn;
  initialPlaceId: number | null;
  /** Scroll to this part of the editor once the place is open. */
  initialSection?: 'hours' | null;
  onSelected: () => void;
}) {
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Location | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  // A place added in this session gets its audio made as soon as it's saved.
  const [justAdded, setJustAdded] = useState<number | null>(null);
  const [bulk, setBulk] = useState<{ text: string; error: boolean } | null>(null);

  // Opened from a report: select that place.
  useEffect(() => {
    if (initialPlaceId === null) return;
    const place = content.places.find(p => p.id === initialPlaceId);
    if (place) {
      setDraft({ ...place });
      setIsNew(false);
      setRouteFilter(place.routeId);
      if (initialSection) setTimeout(() => document.getElementById(initialSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
    onSelected();
  }, [initialPlaceId, initialSection, content.places, onSelected]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return content.places.filter(
      p => (routeFilter === 'all' || p.routeId === routeFilter) && (!q || p.nameEn.toLowerCase().includes(q) || p.nameAr.includes(query.trim()) || OPTIONAL_LANGS.some(l => !!p[fieldKey('name', l)]?.toLowerCase().includes(q))),
    );
  }, [content.places, routeFilter, query]);

  const startNew = () => {
    const routeId = routeFilter !== 'all' ? routeFilter : content.routes[0].id;
    const anchor = content.places.find(p => p.routeId === routeId) ?? CAIRO_CENTRE;
    setDraft({
      id: nextPlaceId(content),
      routeId,
      nameEn: '',
      nameAr: '',
      category: 'monument',
      descriptionEn: '',
      descriptionAr: '',
      // Start slightly off an existing place so coordinates are never identical.
      lat: +(anchor.lat + 0.0003).toFixed(6),
      lng: +(anchor.lng + 0.0003).toFixed(6),
    });
    setIsNew(true);
  };

  const original = draft && !isNew ? content.places.find(p => p.id === draft.id) : undefined;
  const changed = draft && (isNew || !sameValue(original, draft));

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    const next: Content = isNew
      ? { ...content, places: [...content.places, draft] }
      : { ...content, places: content.places.map(p => (p.id === draft.id ? draft : p)) };
    const ok = await save(next, isNew ? `Added "${draft.nameEn}"` : `Edited "${draft.nameEn}"`);
    if (ok) {
      if (isNew) setJustAdded(draft.id);
      setIsNew(false);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!draft || isNew) return setDraft(null);
    if (!window.confirm(`Delete "${draft.nameEn}"? You can restore it from History.`)) return;
    setBusy(true);
    if (await save({ ...content, places: content.places.filter(p => p.id !== draft.id) }, `Deleted "${draft.nameEn}"`)) setDraft(null);
    setBusy(false);
  };

  const set = <K extends keyof Location>(key: K, value: Location[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));
  // Optional per-language text fields (nameFr, feeAr, …): empty ones are left out of the draft.
  const setField = (key: keyof Location, value: string) => setDraft(d => (d ? withOptional(d, key, value) : d));

  // Places still missing each optional language (the app shows their English meanwhile).
  const missingBy = Object.fromEntries(
    OPTIONAL_LANGS.map(lang => [lang, content.places.filter(p => Object.keys(missingPlaceText(p, lang)).length > 0)]),
  ) as Record<OptionalLang, Location[]>;

  /** Drafts every missing name and description in `lang` with Gemini, then saves once (so it's one History entry). */
  const fillAll = async (lang: OptionalLang) => {
    const name = LANGUAGES[lang].english;
    const missing = missingBy[lang];
    if (!window.confirm(`Draft the missing ${name} for ${missing.length} places with Gemini and save it? You can review each place afterwards and restore the previous version from History.`)) return;
    setBusy(true);
    setBulk(null);
    try {
      const filled = new Map<number, Record<string, string>>();
      const CHUNK = 8;
      for (let i = 0; i < missing.length; i += CHUNK) {
        setBulk({ text: `Translating ${Math.min(i + CHUNK, missing.length)} of ${missing.length} into ${name}…`, error: false });
        const texts: Record<string, string> = {};
        for (const p of missing.slice(i, i + CHUNK)) {
          for (const [field, english] of Object.entries(missingPlaceText(p, lang))) texts[`${p.id}.${field}`] = english;
        }
        const { texts: drafts } = await api.translate(texts, lang);
        for (const [key, value] of Object.entries(drafts)) {
          const [id, field] = key.split('.');
          filled.set(Number(id), { ...filled.get(Number(id)), [field]: value });
        }
      }
      const places = content.places.map(p => {
        const fields = filled.get(p.id);
        return fields ? { ...p, ...fields } : p;
      });
      if (await save({ ...content, places }, `Filled in missing ${name} with Gemini (${filled.size} places)`)) {
        setBulk({ text: `${name} drafted for ${filled.size} places and saved. Review them place by place.`, error: false });
      } else setBulk(null);
    } catch (err) {
      setBulk({ text: `Nothing was saved: ${(err as Error).message}`, error: true });
    } finally {
      setBusy(false);
    }
  };
  const routeName = (id: string) => content.routes.find(r => r.id === id)?.nameEn ?? id;

  return (
    <section className="grid md:grid-cols-[320px_1fr] gap-6 items-start">
      <div className="bg-white rounded-2xl border border-sand/50 p-4 md:sticky md:top-24">
        <div className="flex gap-2 mb-3">
          <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} className={inputClass} aria-label="Route">
            <option value="all">All routes ({content.places.length})</option>
            {content.routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.nameEn} ({content.places.filter(p => p.routeId === r.id).length})
              </option>
            ))}
          </select>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-300" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search places" className={`${inputClass} ps-9`} />
        </div>
        <Button onClick={startNew} className="w-full mb-3 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add place
        </Button>
        {OPTIONAL_LANGS.filter(lang => missingBy[lang].length > 0).map(lang => (
          <Button
            key={lang}
            variant="secondary"
            onClick={() => fillAll(lang)}
            // An open draft with unsaved edits would be confusing next to a bulk save.
            disabled={busy || !!changed}
            title={changed ? 'Save or discard the open place first.' : undefined}
            className="w-full mb-3 flex items-center justify-center gap-2"
          >
            <Languages className="w-4 h-4" /> Fill in missing {LANGUAGES[lang].english} ({missingBy[lang].length})
          </Button>
        ))}
        {bulk && <p className={`text-xs mb-3 ${bulk.error ? 'text-red-700' : 'text-stone-500'}`} role={bulk.error ? 'alert' : 'status'}>{bulk.text}</p>}
        <ul className="max-h-[60vh] overflow-y-auto -mx-2">
          {list.map(p => (
            <li key={p.id}>
              <button
                onClick={() => {
                  setDraft({ ...p });
                  setIsNew(false);
                }}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm ${draft?.id === p.id && !isNew ? 'bg-nile/10 text-nile' : 'hover:bg-chalk'}`}
              >
                <span className="block truncate">{p.nameEn}</span>
                <span className="block text-[11px] text-stone-400 truncate">
                  {categories.find(c => c.id === p.category)?.nameEn} · {routeName(p.routeId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!draft ? (
        <p className="text-stone-500 bg-white rounded-2xl border border-sand/50 p-8 text-center">Choose a place to edit, or add a new one.</p>
      ) : (
        <form
          className="bg-white rounded-2xl border border-sand/50 p-6 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif">{isNew ? 'New place' : draft.nameEn || 'Untitled'}</h2>
            <span className="text-xs text-stone-400">ID {draft.id}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Route">
              <select value={draft.routeId} onChange={e => set('routeId', e.target.value)} className={inputClass}>
                {content.routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select value={draft.category} onChange={e => set('category', e.target.value as Location['category'])} className={inputClass}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name (English)">
              <input value={draft.nameEn} onChange={e => set('nameEn', e.target.value)} className={inputClass} maxLength={120} />
            </Field>
            <Field label="Name (Arabic)">
              <input value={draft.nameAr} onChange={e => set('nameAr', e.target.value)} className={inputClass} dir="rtl" maxLength={120} />
            </Field>
          </div>

          <Field label="Description (English)" hint="The audio guide narrates this. New audio is made when you save.">
            <textarea value={draft.descriptionEn} onChange={e => set('descriptionEn', e.target.value)} className={inputClass} rows={4} maxLength={2000} />
          </Field>
          <Field label="Description (Arabic)">
            <textarea value={draft.descriptionAr} onChange={e => set('descriptionAr', e.target.value)} className={inputClass} rows={4} dir="rtl" maxLength={2000} />
          </Field>

          <HoursEditor hours={draft.hours} onChange={hours => setDraft(d => (d ? withOptional(d, 'hours', hours) : d))} />

          <div className="rounded-xl border border-sand/60 p-4 space-y-3">
            <p className="text-xs font-bold text-stone-600">Entry fee (optional)</p>
            <p className="text-[11px] text-stone-400">As visitors should read it, e.g. "EGP 60 · students EGP 30" or "Free". Other languages show the English when empty.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {LANGS.map(lang => {
                const key = fieldKey('fee', lang);
                return (
                  <Field key={lang} label={`Fee (${LANGUAGES[lang].english})`}>
                    <input value={draft[key] ?? ''} onChange={e => setField(key, e.target.value)} className={inputClass} dir={LANGUAGES[lang].dir} lang={lang} maxLength={120} />
                  </Field>
                );
              })}
            </div>
          </div>

          {OPTIONAL_LANGS.map(lang => {
            const name = LANGUAGES[lang].english;
            const nameKey = fieldKey('name', lang);
            const descriptionKey = fieldKey('description', lang);
            return (
              <div key={lang} className="rounded-xl border border-sand/60 p-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-stone-600">{name} (optional)</p>
                  <p className="text-[11px] text-stone-400">Empty fields show the English. {name} audio is narrated from the {name} description, or from the English one until there is one.</p>
                </div>
                <Field label={`Name (${name})`}>
                  <input value={draft[nameKey] ?? ''} onChange={e => setField(nameKey, e.target.value)} className={inputClass} lang={lang} maxLength={120} />
                </Field>
                <Field label={`Description (${name})`}>
                  <textarea value={draft[descriptionKey] ?? ''} onChange={e => setField(descriptionKey, e.target.value)} className={inputClass} rows={4} lang={lang} maxLength={2000} />
                </Field>
                <FillMissingButton
                  key={`${draft.id}-${lang}`}
                  lang={lang}
                  missing={missingPlaceText(draft, lang)}
                  onFilled={texts => setDraft(d => (d ? { ...d, ...texts } : d))}
                />
              </div>
            );
          })}

          {!isNew && original && (
            <AudioPanel
              // A fresh panel per place, so a generation still running for the
              // previous place can't update this one.
              key={draft.id}
              placeId={draft.id}
              draftText={Object.fromEntries(LANGS.map(l => [l, descriptionOf(draft, l)])) as Record<Lang, string>}
              savedText={Object.fromEntries(LANGS.map(l => [l, descriptionOf(original, l)])) as Record<Lang, string>}
              generateOnLoad={justAdded === draft.id}
            />
          )}

          <PhotoField
            photo={draft.photo}
            builtIn={builtInPhoto(`place-${draft.id}`)}
            onChange={photo => setDraft(d => {
              if (!d) return d;
              const { photo: _old, ...rest } = d;
              return photo ? { ...rest, photo } : rest;
            })}
          />

          <div>
            <p className="text-xs font-bold text-stone-500 mb-1">Location</p>
            <p className="text-[11px] text-stone-400 mb-2">Drag the pin or tap the map. {original && 'The grey pin is the saved position.'}</p>
            <MapPicker
              value={{ lat: draft.lat, lng: draft.lng }}
              reference={original && (original.lat !== draft.lat || original.lng !== draft.lng) ? original : undefined}
              onChange={v => setDraft(d => (d ? { ...d, ...v } : d))}
            />
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Field label="Latitude">
                <input type="number" step="0.000001" value={draft.lat} onChange={e => set('lat', Number(e.target.value))} className={inputClass} />
              </Field>
              <Field label="Longitude">
                <input type="number" step="0.000001" value={draft.lng} onChange={e => set('lng', Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={busy || !changed}>
              {busy ? 'Saving…' : isNew ? 'Add place' : 'Save changes'}
            </Button>
            {changed && !isNew && original && (
              <Button type="button" variant="secondary" onClick={() => setDraft({ ...original })}>
                Discard changes
              </Button>
            )}
            <Button type="button" variant="danger" onClick={remove} disabled={busy} className="ms-auto">
              {isNew ? 'Cancel' : 'Delete place'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
