import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Content } from '../data/content';
import { EMERGENCY } from '../lib/help';
import { HELP_LIMITS, helpProblems, normalizeHelp, type HelpContact, type HelpContent, type HelpPhrase, type HelpTip } from '../lib/help-content';
import { withoutDrafted } from '../lib/drafted';
import { LANGUAGES, OPTIONAL_LANGS, type OptionalLang } from '../i18n/lang';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, Field, inputClass, sameValue } from './ui';
import { DraftReview } from './DraftReview';
import { FillMissingButton, fillEmpty, fieldKey, typedField } from './translations';

const EMPTY: HelpContent = { contacts: [], tips: [], phrases: [] };
type ListName = keyof HelpContent;
const NEW: { [K in ListName]: () => HelpContent[K][number] } = {
  contacts: () => ({ nameEn: '', nameAr: '', phone: '' }),
  tips: () => ({ textEn: '', textAr: '' }),
  phrases: () => ({ ar: '', meaningEn: '' }),
};
/** The field translated in each list: a contact's name, a tip's text, a phrase's meaning. */
const BASE: Record<ListName, 'name' | 'text' | 'meaning'> = { contacts: 'name', tips: 'text', phrases: 'meaning' };
const ENGLISH: Record<ListName, string> = { contacts: 'nameEn', tips: 'textEn', phrases: 'meaningEn' };

/** French or Spanish still empty in the Help items, keyed "contacts.0.nameFr", with the English to translate. */
export function missingHelpText(help: HelpContent, lang: OptionalLang): Record<string, string> {
  const missing: Record<string, string> = {};
  for (const list of Object.keys(BASE) as ListName[]) {
    help[list].forEach((item, i) => {
      const key = fieldKey(BASE[list], lang);
      const english = (item as unknown as Record<string, string>)[ENGLISH[list]];
      if (!(item as unknown as Record<string, string>)[key] && english?.trim()) missing[`${list}.${i}.${key}`] = english;
    });
  }
  return missing;
}

/**
 * Gemini's drafts put into the items' empty fields, marked as drafts to review.
 * With `sent` (the English each draft was made from), a draft is dropped when
 * its item's English no longer matches: the item was removed, moved up after
 * one above it was removed, or edited while the request was running.
 */
export function applyHelpDrafts(help: HelpContent, texts: Record<string, string>, sent?: Record<string, string>): HelpContent {
  const next: HelpContent = { contacts: [...help.contacts], tips: [...help.tips], phrases: [...help.phrases] };
  for (const [path, text] of Object.entries(texts)) {
    const [list, index, key] = path.split('.') as [ListName, string, string];
    const items = next[list] as object[] | undefined;
    const i = Number(index);
    if (!items || !items[i]) continue;
    if (sent && (items[i] as Record<string, string>)[ENGLISH[list]] !== sent[path]) continue;
    items[i] = fillEmpty(items[i], { [key]: text }, [key]);
  }
  return next;
}

/**
 * The Help sheet's own content: local contacts (a guide, a hotel) shown to
 * call with one tap, extra tips under "Good to know", and extra phrases to
 * show in Arabic. The emergency numbers are fixed in the app.
 */
export function HelpTab({ content, save }: { content: Content; save: SaveFn }) {
  const saved = content.help ?? EMPTY;
  const [draft, setDraft] = useState<HelpContent>(saved);
  const [busy, setBusy] = useState(false);
  // A new saved version (after saving, or restoring from History) replaces the form.
  useEffect(() => setDraft(content.help ?? EMPTY), [content.help]);

  const normalized = normalizeHelp(draft);
  const changed = !sameValue(normalized ?? EMPTY, saved);
  const problems = normalized ? helpProblems(normalized) : [];

  const update = <K extends ListName>(list: K, i: number, item: HelpContent[K][number]) =>
    setDraft(d => ({ ...d, [list]: d[list].map((x, j) => (j === i ? item : x)) }));
  const remove = (list: ListName, i: number) => setDraft(d => ({ ...d, [list]: d[list].filter((_, j) => j !== i) }));
  const add = (list: ListName) => setDraft(d => ({ ...d, [list]: [...d[list], NEW[list]()] }));
  // A field typed by hand: set, and no longer a Gemini draft.
  // French and Spanish are optional: an emptied one is left out, as elsewhere in the admin.
  const typed = <K extends ListName>(list: K, i: number, item: HelpContent[K][number], key: string, value: string) =>
    update(list, i, (/(Fr|Es)$/.test(key) ? typedField(item, key as never, value) : withoutDrafted({ ...item, [key]: value }, [key])) as never);

  const submit = async () => {
    setBusy(true);
    const { help: _, ...rest } = content;
    await save(normalized ? { ...rest, help: normalized } : rest, 'Edited the Help sheet');
    setBusy(false);
  };

  const removeButton = (list: ListName, i: number, what: string) => (
    <button type="button" onClick={() => remove(list, i)} aria-label={`Remove ${what}`} className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700">
      <Trash2 className="w-4 h-4" />
    </button>
  );
  const addButton = (list: ListName, what: string) =>
    draft[list].length < HELP_LIMITS.items && (
      <Button type="button" variant="secondary" onClick={() => add(list)} className="flex items-center gap-2">
        <Plus className="w-4 h-4" /> Add {what}
      </Button>
    );

  return (
    <form
      className="bg-white rounded-2xl border border-sand/50 p-5 space-y-8 max-w-3xl"
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h2 className="text-xl font-serif">Help sheet</h2>
        <p className="text-sm text-stone-500 mt-1">
          What visitors see under <strong>Help</strong> in the app, besides what's built in. It works offline after their next visit. The emergency numbers are fixed:{' '}
          {EMERGENCY.map(e => e.number).join(', ')}.
        </p>
      </div>

      <section aria-labelledby="help-contacts" className="space-y-3">
        <h3 id="help-contacts" className="text-xs font-bold uppercase tracking-widest text-stone-500">Local contacts ({draft.contacts.length}/{HELP_LIMITS.items})</h3>
        <p className="text-xs text-stone-400">Shown to call with one tap, under the emergency numbers: a guide, a hotel's reception, a tour operator.</p>
        {draft.contacts.map((c, i) => (
          <div key={i} className="rounded-xl border border-sand/60 p-3 space-y-3">
            <DraftReview item={c} onChange={next => update('contacts', i, next as HelpContact)} />
            <div className="flex items-start gap-2">
              <div className="grid sm:grid-cols-3 gap-3 flex-1">
                <Field label="Name (English)"><input value={c.nameEn} onChange={e => typed('contacts', i, c, 'nameEn', e.target.value)} className={inputClass} maxLength={HELP_LIMITS.name} placeholder="Your guide, Ahmed" /></Field>
                <Field label="Name (Arabic)"><input value={c.nameAr} onChange={e => typed('contacts', i, c, 'nameAr', e.target.value)} className={inputClass} maxLength={HELP_LIMITS.name} dir="rtl" /></Field>
                <Field label="Phone"><input value={c.phone} onChange={e => typed('contacts', i, c, 'phone', e.target.value)} className={inputClass} inputMode="tel" dir="ltr" placeholder="+20 100 123 4567" /></Field>
                {OPTIONAL_LANGS.map(l => (
                  <Field key={l} label={`Name (${LANGUAGES[l].english})`}><input value={c[fieldKey('name', l)] ?? ''} onChange={e => typed('contacts', i, c, fieldKey('name', l), e.target.value)} className={inputClass} maxLength={HELP_LIMITS.name} lang={l} /></Field>
                ))}
              </div>
              {removeButton('contacts', i, `contact ${c.nameEn || i + 1}`)}
            </div>
          </div>
        ))}
        {addButton('contacts', 'a contact')}
      </section>

      <section aria-labelledby="help-tips" className="space-y-3">
        <h3 id="help-tips" className="text-xs font-bold uppercase tracking-widest text-stone-500">Extra tips ({draft.tips.length}/{HELP_LIMITS.items})</h3>
        <p className="text-xs text-stone-400">Added under "Good to know", e.g. Ramadan hours or a street that's closed.</p>
        {draft.tips.map((t, i) => (
          <div key={i} className="rounded-xl border border-sand/60 p-3 space-y-3">
            <DraftReview item={t} onChange={next => update('tips', i, next as HelpTip)} />
            <div className="flex items-start gap-2">
              <div className="grid sm:grid-cols-2 gap-3 flex-1">
                <Field label="Tip (English)"><textarea value={t.textEn} onChange={e => typed('tips', i, t, 'textEn', e.target.value)} className={inputClass} rows={2} maxLength={HELP_LIMITS.tip} /></Field>
                <Field label="Tip (Arabic)"><textarea value={t.textAr} onChange={e => typed('tips', i, t, 'textAr', e.target.value)} className={inputClass} rows={2} maxLength={HELP_LIMITS.tip} dir="rtl" /></Field>
                {OPTIONAL_LANGS.map(l => (
                  <Field key={l} label={`Tip (${LANGUAGES[l].english})`}><textarea value={t[fieldKey('text', l)] ?? ''} onChange={e => typed('tips', i, t, fieldKey('text', l), e.target.value)} className={inputClass} rows={2} maxLength={HELP_LIMITS.tip} lang={l} /></Field>
                ))}
              </div>
              {removeButton('tips', i, `tip ${i + 1}`)}
            </div>
          </div>
        ))}
        {addButton('tips', 'a tip')}
      </section>

      <section aria-labelledby="help-phrases" className="space-y-3">
        <h3 id="help-phrases" className="text-xs font-bold uppercase tracking-widest text-stone-500">Extra phrases ({draft.phrases.length}/{HELP_LIMITS.items})</h3>
        <p className="text-xs text-stone-400">Shown large in Arabic to someone, with what it means in the visitor's language.</p>
        {draft.phrases.map((p, i) => (
          <div key={i} className="rounded-xl border border-sand/60 p-3 space-y-3">
            <DraftReview item={p} onChange={next => update('phrases', i, next as HelpPhrase)} />
            <div className="flex items-start gap-2">
              <div className="grid sm:grid-cols-2 gap-3 flex-1">
                <Field label="Phrase (Arabic)"><input value={p.ar} onChange={e => typed('phrases', i, p, 'ar', e.target.value)} className={inputClass} maxLength={HELP_LIMITS.phrase} dir="rtl" /></Field>
                <Field label="Meaning (English)"><input value={p.meaningEn} onChange={e => typed('phrases', i, p, 'meaningEn', e.target.value)} className={inputClass} maxLength={HELP_LIMITS.phrase} /></Field>
                {OPTIONAL_LANGS.map(l => (
                  <Field key={l} label={`Meaning (${LANGUAGES[l].english})`}><input value={p[fieldKey('meaning', l)] ?? ''} onChange={e => typed('phrases', i, p, fieldKey('meaning', l), e.target.value)} className={inputClass} maxLength={HELP_LIMITS.phrase} lang={l} /></Field>
                ))}
              </div>
              {removeButton('phrases', i, `phrase ${i + 1}`)}
            </div>
          </div>
        ))}
        {addButton('phrases', 'a phrase')}
      </section>

      <div className="flex flex-wrap gap-3">
        {OPTIONAL_LANGS.map(l => (
          <FillMissingButton key={l} lang={l} missing={missingHelpText(draft, l)} onFilled={(texts, sent) => setDraft(d => applyHelpDrafts(d, texts, sent))} />
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
