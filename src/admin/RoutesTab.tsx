import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import type { Content, Route } from '../data/content';
import type { SaveFn } from './AdminApp';
import { Button, Field, inputClass, sameValue } from './ui';
import { PhotoField } from './PhotoField';
import { PHOTO_ALT_KEYS, PhotoAltFields, withoutPhotoAlts } from './PhotoAltFields';
import { builtInPhoto } from '../data/photo-resolve';
import { applyStopOrder, walkPlan, walkStops } from '../lib/walk';
import { RouteQr } from './RouteQr';
import { RouteAudio } from './RouteAudio';
import { DraftReview } from './DraftReview';
import { fieldKey, FillMissingButton, withOptional, fillEmpty, typedField } from './translations';
import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang, type OptionalLang } from '../i18n/lang';
import { routeText } from '../lib/route-format';
import { plannedKm, plannedWalk, type PlaceSection } from './content-health';
import { routeAccess } from '../lib/step-free';
import { withDrafted, withoutDrafted } from '../lib/drafted';

const blankRoute = (): Route => ({
  id: '',
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  image: '',
  highlightsEn: [],
  highlightsAr: [],
  distanceKm: NaN,
  hoursMin: NaN,
  hoursMax: NaN,
  distance: '',
  duration: '',
});

export function RoutesTab({ content, save, initialRouteId = null, onSelected, onEditPlace }: {
  content: Content;
  save: SaveFn;
  /** Open this route on arrival (from the Content checklist). */
  initialRouteId?: string | null;
  onSelected?: () => void;
  /** Open a place in the Places tab, at a section (the stops not yet checked for access). */
  onEditPlace?: (placeId: number, section: PlaceSection) => void;
}) {
  const [draft, setDraft] = useState<Route | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  // Highlights are edited as raw text (one per line) and split only when saving,
  // so spaces and new lines aren't trimmed away while typing.
  const [highlights, setHighlights] = useState<Record<Lang, string>>({ en: '', ar: '', fr: '', es: '' });
  // The stops' walking order, as place IDs. Applied to the places when saving.
  const [order, setOrder] = useState<number[]>([]);

  const lines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);
  const open = (route: Route, asNew: boolean) => {
    setDraft({ ...route, highlightsEn: [...route.highlightsEn], highlightsAr: [...route.highlightsAr] });
    setHighlights(Object.fromEntries(LANGS.map(l => [l, (route[fieldKey('highlights', l)] ?? []).join('\n')])) as Record<Lang, string>);
    setOrder(asNew ? [] : walkStops(content.places, route.id).map(p => p.id));
    setIsNew(asNew);
  };
  // Opened from the Content checklist: select that route.
  useEffect(() => {
    if (!initialRouteId) return;
    const route = content.routes.find(r => r.id === initialRouteId);
    if (route) open(route, false);
    onSelected?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRouteId]);

  // The walk between the stops in the order being edited, to check the distance against.
  const planned = draft && !isNew ? plannedWalk(applyStopOrder(content.places, draft.id, order), draft.id) : { meters: 0, minutes: 0, stops: 0 };

  const finalDraft = draft && OPTIONAL_LANGS.reduce(
    (r, l) => withOptional(r, fieldKey('highlights', l), lines(highlights[l])),
    { ...draft, highlightsEn: lines(highlights.en), highlightsAr: lines(highlights.ar) },
  );

  const original = draft && !isNew ? content.routes.find(r => r.id === draft.id) : undefined;
  const savedOrder = draft && !isNew ? walkStops(content.places, draft.id).map(p => p.id) : [];
  const orderChanged = order.join() !== savedOrder.join();
  const changed = finalDraft && (isNew || orderChanged || !sameValue(original, finalDraft));
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
  // Number fields: empty is NaN (the save check says what's missing). The English text follows the numbers.
  const setNumber = (key: 'distanceKm' | 'hoursMin' | 'hoursMax', value: string) =>
    setDraft(d => {
      if (!d) return d;
      const next = { ...d, [key]: value === '' ? NaN : Number(value) };
      return { ...next, ...routeText(next) };
    });
  const numberValue = (n: number) => (Number.isFinite(n) ? String(n) : '');
  const setField = (key: keyof Route, value: string) => setDraft(d => (d ? typedField(d, key, value) : d));

  // Empty fields in an optional language, with the English to draft them from. Highlights go line by line.
  const missingIn = (lang: OptionalLang): Record<string, string> => {
    const missing: Record<string, string> = {};
    if (!draft) return missing;
    const name = fieldKey('name', lang);
    const description = fieldKey('description', lang);
    if (!draft[name] && draft.nameEn.trim()) missing[name] = draft.nameEn;
    if (!draft[description] && draft.descriptionEn.trim()) missing[description] = draft.descriptionEn;
    for (const base of ['metro', 'gettingThere'] as const) {
      const key = fieldKey(base, lang);
      const english = draft[fieldKey(base, 'en')];
      if (!draft[key] && english?.trim()) missing[key] = english;
    }
    if (!lines(highlights[lang]).length) lines(highlights.en).forEach((line, i) => (missing[`h${i}`] = line));
    return missing;
  };
  const applyDrafts = (lang: OptionalLang, texts: Record<string, string>) => {
    setDraft(d => d && fillEmpty(d, texts, [fieldKey('name', lang), fieldKey('description', lang), fieldKey('metro', lang), fieldKey('gettingThere', lang)]));
    const drafted = lines(highlights.en).map((_, i) => texts[`h${i}`]).filter(Boolean);
    if (drafted.length && !lines(highlights[lang]).length) {
      setHighlights(h => (lines(h[lang]).length ? h : { ...h, [lang]: drafted.join('\n') }));
      setDraft(d => d && withDrafted(d, [fieldKey('highlights', lang)]));
    }
  };

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
    const detailsChanged = isNew || !sameValue(original, finalDraft);
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
          <DraftReview item={draft} onChange={next => setDraft(next)} />
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
            {OPTIONAL_LANGS.map(lang => {
              const name = LANGUAGES[lang].english;
              const nameKey = fieldKey('name', lang);
              const descriptionKey = fieldKey('description', lang);
              return (
                <React.Fragment key={lang}>
                  <Field label={`Name (${name})`} hint={`Optional. Empty ${name} fields show the English.`}>
                    <input value={draft[nameKey] ?? ''} onChange={e => setField(nameKey, e.target.value)} className={inputClass} lang={lang} />
                  </Field>
                  <Field label={`Description (${name})`}>
                    <textarea value={draft[descriptionKey] ?? ''} onChange={e => setField(descriptionKey, e.target.value)} className={inputClass} rows={3} lang={lang} />
                  </Field>
                  <Field label={`Highlights (${name})`} hint="Optional. One per line, up to 8.">
                    <textarea
                      value={highlights[lang]}
                      onChange={e => {
                        setHighlights(h => ({ ...h, [lang]: e.target.value }));
                        // Typed by hand: no longer a draft to review.
                        setDraft(d => d && withoutDrafted(d, [fieldKey('highlights', lang)]));
                      }}
                      className={inputClass}
                      rows={3}
                      lang={lang}
                    />
                  </Field>
                  {(draft.metroEn || draft[fieldKey('metro', lang)]) && (
                    <Field label={`Nearest metro (${name})`}>
                      <input value={draft[fieldKey('metro', lang)] ?? ''} onChange={e => setField(fieldKey('metro', lang), e.target.value)} className={inputClass} lang={lang} maxLength={80} />
                    </Field>
                  )}
                  {(draft.gettingThereEn || draft[fieldKey('gettingThere', lang)]) && (
                    <Field label={`Getting there note (${name})`}>
                      <textarea value={draft[fieldKey('gettingThere', lang)] ?? ''} onChange={e => setField(fieldKey('gettingThere', lang), e.target.value)} className={inputClass} rows={2} lang={lang} maxLength={300} />
                    </Field>
                  )}
                  <div className="flex items-end">
                    <FillMissingButton key={`${draft.id}-${lang}`} lang={lang} missing={missingIn(lang)} onFilled={texts => applyDrafts(lang, texts)} />
                  </div>
                </React.Fragment>
              );
            })}
            <div>
              <Field label="Distance (km)" hint="e.g. 2.5">
                <input type="number" inputMode="decimal" min="0.1" max="50" step="0.1" value={numberValue(draft.distanceKm)} onChange={e => setNumber('distanceKm', e.target.value)} className={inputClass} />
              </Field>
              {/* Outside the label, so the button isn't part of the field's name. */}
              {planned.stops > 1 && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  Planned walk from the {planned.stops} stops: ≈ {plannedKm(planned.meters)} km, about {planned.minutes} min of walking.
                  {plannedKm(planned.meters) !== draft.distanceKm && (
                    <button type="button" onClick={() => setNumber('distanceKm', String(plannedKm(planned.meters)))} className="min-h-11 px-2 font-bold text-nile hover:underline">
                      Use {plannedKm(planned.meters)} km
                    </button>
                  )}
                </p>
              )}
            </div>
            <Field label="Walking time (hours)" hint="From and to, e.g. 2 to 3. Use the same number twice for one value.">
              <div className="flex items-center gap-2">
                <input type="number" inputMode="decimal" min="0.25" max="24" step="0.25" value={numberValue(draft.hoursMin)} onChange={e => setNumber('hoursMin', e.target.value)} className={inputClass} aria-label="Walking time from (hours)" />
                <span className="text-stone-400 text-sm">to</span>
                <input type="number" inputMode="decimal" min="0.25" max="24" step="0.25" value={numberValue(draft.hoursMax)} onChange={e => setNumber('hoursMax', e.target.value)} className={inputClass} aria-label="Walking time to (hours)" />
              </div>
            </Field>
          </div>
          {!isNew && (
            <div id="getting-there" className="rounded-xl border border-sand/60 p-4 space-y-3 scroll-mt-24">
              <p className="text-xs font-bold text-stone-600">Getting there</p>
              <p className="text-[11px] text-stone-400">
                Shown under the route's buttons: where the walk starts, directions to it, a card with its Arabic name to show a taxi driver, and the nearest metro station.
              </p>
              <Field label="Start point" hint="Where visitors should go first. A meeting point works well.">
                <select
                  value={draft.startId ?? ''}
                  onChange={e => setDraft(d => (d ? withOptional(d, 'startId', e.target.value ? Number(e.target.value) : undefined) : d))}
                  className={inputClass}
                >
                  <option value="">First stop{walkStops(orderedPlaces, draft.id)[0] ? ` (${walkStops(orderedPlaces, draft.id)[0].nameEn})` : ''}</option>
                  {content.places.filter(p => p.routeId === draft.id).map(p => (
                    <option key={p.id} value={p.id}>{p.nameEn}</option>
                  ))}
                </select>
              </Field>
              <div className="grid sm:grid-cols-[1fr_1fr_8rem] gap-3">
                <Field label="Nearest metro (English)">
                  <input value={draft.metroEn ?? ''} onChange={e => setField('metroEn', e.target.value)} className={inputClass} maxLength={80} placeholder="e.g. Attaba" />
                </Field>
                <Field label="Nearest metro (Arabic)">
                  <input value={draft.metroAr ?? ''} onChange={e => setField('metroAr', e.target.value)} className={inputClass} maxLength={80} dir="rtl" placeholder="مثال: العتبة" />
                </Field>
                <Field label="Walk (minutes)">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="60"
                    step="1"
                    value={draft.metroMinutes ?? ''}
                    onChange={e => setDraft(d => (d ? withOptional(d, 'metroMinutes', e.target.value ? Number(e.target.value) : undefined) : d))}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Note (English)" hint="Optional, e.g. “Ask for Bab Zuweila: cars can't enter the street.”">
                  <textarea value={draft.gettingThereEn ?? ''} onChange={e => setField('gettingThereEn', e.target.value)} className={inputClass} rows={2} maxLength={300} />
                </Field>
                <Field label="Note (Arabic)">
                  <textarea value={draft.gettingThereAr ?? ''} onChange={e => setField('gettingThereAr', e.target.value)} className={inputClass} rows={2} maxLength={300} dir="rtl" />
                </Field>
              </div>
            </div>
          )}
          <PhotoField
            photo={draft.photo}
            builtIn={draft.id ? builtInPhoto(`route-${draft.id}`) : undefined}
            onChange={photo => setDraft(d => {
              if (!d) return d;
              const { photo: old, ...kept } = d;
              // A different photo: the descriptions were of the old one.
              const rest = old?.src === photo?.src ? kept : withoutPhotoAlts(kept);
              return photo ? { ...rest, photo } : rest;
            })}
          />
          <PhotoAltFields
            item={draft}
            src={(draft.photo ?? (draft.id ? builtInPhoto(`route-${draft.id}`) : undefined))?.src}
            name={draft.nameEn}
            onChange={(key, value) => setDraft(d => (d ? typedField(d, key, value) : d))}
            onDraft={texts => setDraft(d => (d ? fillEmpty(d, texts, PHOTO_ALT_KEYS) : d))}
          />
          {!isNew && original && <RouteQr route={original} />}
          {!isNew && original && placeCount(original.id) > 0 && <RouteAudio key={original.id} places={content.places.filter(p => p.routeId === original.id)} />}
          {!isNew && order.length > 0 && <StepFreeSummary places={orderedPlaces} routeId={draft.id} unsaved={!!changed} onEditPlace={onEditPlace} />}
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

/** "Step-free: 12 of 20 stops", as visitors see it, with links to the stops whose access isn't set yet. */
function StepFreeSummary({ places, routeId, unsaved, onEditPlace }: {
  places: Content['places'];
  routeId: string;
  unsaved: boolean;
  onEditPlace?: (placeId: number, section: PlaceSection) => void;
}) {
  const a = routeAccess(places, routeId);
  return (
    <div className="rounded-xl border border-sand/60 p-4">
      <p className="text-xs font-bold text-stone-600">Step-free access</p>
      <p className="mt-1 text-sm">
        Step-free: {a.yes} of {a.total} stops{a.partial > 0 && ` · ${a.partial} partly`}{a.no > 0 && ` · ${a.no} not step-free`}
      </p>
      {a.unchecked.length === a.total ? (
        <p className="mt-1 text-[11px] text-stone-400">No stop has its access set yet, so visitors don't see a summary. Set it in each place's visitor tips.</p>
      ) : (
        a.unchecked.length > 0 && <p className="mt-1 text-[11px] text-stone-400">Visitors also see "{a.unchecked.length} not yet checked".</p>
      )}
      {a.unchecked.length > 0 && (
        <>
          <p className="mt-2 text-xs font-bold text-stone-600">Not yet checked</p>
          <ul className="mt-1 flex flex-wrap gap-x-1">
            {a.unchecked.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => {
                    if (unsaved && !window.confirm('Leave this route without saving your changes?')) return;
                    onEditPlace?.(p.id, 'tips');
                  }} className="min-h-11 px-2 text-xs font-bold text-nile hover:underline">
                  {p.nameEn}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
