import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Content } from '../data/content';
import { NOTICE_LIMITS, isActive, isExpired, noticeProblems, normalizeNotices, type Notice } from '../lib/notices';
import { cairoDate } from '../lib/special-hours';
import { withoutDrafted } from '../lib/drafted';
import { LANGUAGES, OPTIONAL_LANGS, type OptionalLang } from '../i18n/lang';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, Field, inputClass, sameValue } from './ui';
import { DraftReview } from './DraftReview';
import { FillMissingButton, fillEmpty, fieldKey, typedField } from './translations';

/** French or Spanish still empty in the notices, keyed "0.textFr", with the English to translate. */
export function missingNoticeText(notices: Notice[], lang: OptionalLang): Record<string, string> {
  const missing: Record<string, string> = {};
  notices.forEach((n, i) => {
    const key = fieldKey('text', lang);
    if (!n[key] && n.textEn.trim()) missing[`${i}.${key}`] = n.textEn;
  });
  return missing;
}

/**
 * Gemini's drafts put into the notices' empty fields, marked as drafts to
 * review. A draft is dropped when its notice's English no longer matches what
 * was sent: the notice was removed, moved up, or edited during the request.
 */
export function applyNoticeDrafts(notices: Notice[], texts: Record<string, string>, sent: Record<string, string>): Notice[] {
  const next = [...notices];
  for (const [path, text] of Object.entries(texts)) {
    const [index, key] = path.split('.');
    const i = Number(index);
    if (!next[i] || next[i].textEn !== sent[path]) continue;
    next[i] = fillEmpty(next[i], { [key]: text }, [key]);
  }
  return next;
}

/** Where a notice shows, as one select value: "app", "route:<id>" or "place:<id>". */
const scopeValue = (n: Notice) => (n.routeId !== undefined ? `route:${n.routeId}` : n.placeId !== undefined ? `place:${n.placeId}` : 'app');
function withScope(n: Notice, value: string): Notice {
  const { routeId: _r, placeId: _p, ...rest } = n;
  if (value.startsWith('route:')) return { ...rest, routeId: value.slice(6) };
  if (value.startsWith('place:')) return { ...rest, placeId: Number(value.slice(6)) };
  return rest;
}

function status(n: Notice, today: string): { text: string; tone: string } {
  if (isExpired(n, today)) return { text: `Ended ${n.until}: remove it`, tone: 'text-red-700' };
  if (isActive(n, today)) return { text: n.until ? `Showing now, until ${n.until}` : 'Showing now', tone: 'text-nile' };
  return { text: `Starts ${n.from}`, tone: 'text-stone-500' };
}

/**
 * Notices for visitors: closures, works, events. Each shows everywhere, on one
 * route or on one place, optionally between two Cairo dates.
 */
export function NoticesTab({ content, save }: { content: Content; save: SaveFn }) {
  const saved = content.notices ?? [];
  const [draft, setDraft] = useState<Notice[]>(saved);
  const [busy, setBusy] = useState(false);
  // A new saved version (after saving, or restoring from History) replaces the form.
  useEffect(() => setDraft(content.notices ?? []), [content.notices]);

  const normalized = normalizeNotices(draft);
  const changed = !sameValue(normalized ?? [], saved);
  const problems = normalized ? noticeProblems(normalized, new Set(content.routes.map(r => r.id)), new Set(content.places.map(p => p.id))) : [];
  const today = cairoDate(new Date());

  const update = (i: number, n: Notice) => setDraft(d => d.map((x, j) => (j === i ? n : x)));
  // A field typed by hand: set, and no longer a Gemini draft. An emptied French or Spanish field is left out.
  const typed = (i: number, n: Notice, key: string, value: string) =>
    update(i, /(Fr|Es)$/.test(key) ? typedField(n, key as never, value) : withoutDrafted({ ...n, [key]: value }, [key]));
  const setDate = (i: number, n: Notice, key: 'from' | 'until', value: string) => {
    const next = { ...n };
    if (value) next[key] = value;
    else delete next[key];
    update(i, next);
  };

  const submit = async () => {
    setBusy(true);
    const { notices: _, ...rest } = content;
    await save(normalized ? { ...rest, notices: normalized } : rest, 'Edited the notices');
    setBusy(false);
  };

  return (
    <form
      className="bg-white rounded-2xl border border-sand/50 p-5 space-y-6 max-w-3xl"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h2 className="text-xl font-serif">Notices</h2>
        <p className="text-sm text-stone-500 mt-1">
          Short announcements for visitors: a closure, building works, a crowded market day. They show as a banner everywhere, at the top of one route, or on one place's card and in walk mode, from the first day to the last (Cairo time). Visitors can close a notice; an <strong>important</strong> one can't be closed and shows first. Changed opening times go in <strong>Special hours</strong>.
        </p>
      </div>

      {draft.length === 0 && <p className="text-sm text-stone-400">No notices.</p>}
      {draft.map((n, i) => {
        const s = status(n, today);
        return (
          <fieldset key={i} className="rounded-xl border border-sand/60 p-3 space-y-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-widest text-stone-500">
              Notice {i + 1} · <span className={`normal-case tracking-normal font-medium ${s.tone}`}>{s.text}</span>
            </legend>
            <DraftReview item={n} onChange={next => update(i, next as Notice)} />
            <div className="flex items-start gap-2">
              <div className="grid sm:grid-cols-2 gap-3 flex-1">
                <Field label="Text (English)"><textarea value={n.textEn} onChange={e => typed(i, n, 'textEn', e.target.value)} className={inputClass} rows={2} maxLength={NOTICE_LIMITS.text} placeholder="The minarets of Bab Zuweila are closed for restoration." /></Field>
                <Field label="Text (Arabic)"><textarea value={n.textAr} onChange={e => typed(i, n, 'textAr', e.target.value)} className={inputClass} rows={2} maxLength={NOTICE_LIMITS.text} dir="rtl" /></Field>
                {OPTIONAL_LANGS.map(l => (
                  <Field key={l} label={`Text (${LANGUAGES[l].english})`}><textarea value={n[fieldKey('text', l)] ?? ''} onChange={e => typed(i, n, fieldKey('text', l), e.target.value)} className={inputClass} rows={2} maxLength={NOTICE_LIMITS.text} lang={l} /></Field>
                ))}
                <Field label="Shows on">
                  <select value={scopeValue(n)} onChange={e => update(i, withScope(n, e.target.value))} className={inputClass}>
                    <option value="app">Everywhere (under the header)</option>
                    <optgroup label="A route (top of the route)">
                      {content.routes.map(r => <option key={r.id} value={`route:${r.id}`}>{r.nameEn}</option>)}
                    </optgroup>
                    {content.routes.map(r => (
                      <optgroup key={r.id} label={`A place on ${r.nameEn}`}>
                        {content.places.filter(p => p.routeId === r.id).map(p => <option key={p.id} value={`place:${p.id}`}>{p.nameEn}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-stone-700 sm:mt-6 min-h-11">
                  <input type="checkbox" checked={!!n.important} onChange={e => update(i, e.target.checked ? { ...n, important: true } : (({ important: _, ...rest }) => rest)(n))} className="w-4 h-4 accent-nile" />
                  Important (safety): can't be closed
                </label>
                <Field label="First day (optional)"><input type="date" value={n.from ?? ''} onChange={e => setDate(i, n, 'from', e.target.value)} className={inputClass} /></Field>
                <Field label="Last day (optional)"><input type="date" value={n.until ?? ''} min={n.from} onChange={e => setDate(i, n, 'until', e.target.value)} className={inputClass} /></Field>
              </div>
              <button type="button" onClick={() => setDraft(d => d.filter((_, j) => j !== i))} aria-label={`Remove notice ${i + 1}`} className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </fieldset>
        );
      })}
      {draft.length < NOTICE_LIMITS.notices && (
        <Button type="button" variant="secondary" onClick={() => setDraft(d => [...d, { textEn: '', textAr: '' }])} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add a notice
        </Button>
      )}

      <div className="flex flex-wrap gap-3">
        {OPTIONAL_LANGS.map(l => (
          <FillMissingButton key={l} lang={l} missing={missingNoticeText(draft, l)} onFilled={(texts, sent) => setDraft(d => applyNoticeDrafts(d, texts, sent))} />
        ))}
      </div>

      {problems.length > 0 && changed && <ErrorBox message="Before saving:" problems={problems} />}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !changed || problems.length > 0}>{busy ? 'Saving…' : 'Save changes'}</Button>
        {changed && (
          <Button type="button" variant="secondary" onClick={() => setDraft(saved)}>
            Discard changes
          </Button>
        )}
      </div>
    </form>
  );
}
