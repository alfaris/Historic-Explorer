import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Content } from '../data/content';
import { glossaryOf } from '../data/content';
import { glossaryProblems, glossarySegments, type GlossaryTerm } from '../lib/glossary';
import { LANGS, LANGUAGES, isOptionalLang, type Lang, type OptionalLang } from '../i18n/lang';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, Field, inputClass, sameValue } from './ui';
import { missingText } from './content-health';
import { FillMissingButton, fillEmpty } from './translations';

const blank = (): GlossaryTerm => ({ id: '', termEn: '', termAr: '', defEn: '', defAr: '', match: [] });
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (kind: 'term' | 'def', lang: Lang) => `${kind}${LANGUAGES[lang].suffix}` as const;
const missingKeys = (lang: OptionalLang) => [key('term', lang), key('def', lang)];

/**
 * The architecture terms linked in place descriptions. Until the first save
 * here, the app uses the built-in list; saving stores the whole list with the
 * content.
 */
export function GlossaryTab({ content, save, initialId = null, onSelected }: {
  content: Content;
  save: SaveFn;
  /** Open this term on arrival (from the Content checklist). */
  initialId?: string | null;
  onSelected?: () => void;
}) {
  const terms = glossaryOf(content);
  const [draft, setDraft] = useState<GlossaryTerm | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  // The spellings, edited as text (one per line) and split when saving.
  const [spellings, setSpellings] = useState('');
  const [busy, setBusy] = useState(false);
  // Counts each opening of the editor: keys the fill buttons, so a translation still on its way is dropped when another item is opened.
  const [session, setSession] = useState(0);

  const open = (t: GlossaryTerm | null) => {
    const term = t ?? blank();
    setDraft({ ...term, match: [...term.match] });
    setSpellings(term.match.join('\n'));
    setOriginalId(t ? t.id : null);
    setSession(n => n + 1);
  };

  useEffect(() => {
    if (!initialId) return;
    const term = terms.find(t => t.id === initialId);
    if (term) open(term);
    onSelected?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const final = draft && { ...draft, id: draft.id || slug(draft.termEn), match: [...new Set(spellings.split('\n').map(s => s.trim()).filter(Boolean))] };
  const original = originalId ? terms.find(t => t.id === originalId) : undefined;
  const changed = final && (!original || !sameValue(original, final));
  const problems = final ? glossaryProblems([final]) : [];
  if (final && !original && terms.some(t => t.id === final.id)) problems.push(`A term with the ID "${final.id}" already exists.`);

  // Where the spellings would link, across every place's descriptions, to check they catch the right words.
  const examples = useMemo(() => {
    if (!final || !final.match.length) return [];
    const found: { place: string; text: string; lang: Lang }[] = [];
    for (const p of content.places) {
      for (const lang of LANGS) {
        const text = p[`description${LANGUAGES[lang].suffix}` as const] ?? '';
        const hit = glossarySegments(text, [final]).find(s => typeof s !== 'string');
        if (hit && typeof hit !== 'string') found.push({ place: p.nameEn, text: hit.text, lang });
      }
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spellings, content.places]);

  const set = (k: keyof GlossaryTerm, value: string) =>
    setDraft(d => {
      if (!d) return d;
      const next = { ...d } as Record<string, unknown>;
      if (value.trim() || k === 'termEn' || k === 'termAr' || k === 'defEn' || k === 'defAr' || k === 'id') next[k] = value;
      else delete next[k];
      return next as unknown as GlossaryTerm;
    });

  const submit = async () => {
    if (!final) return;
    setBusy(true);
    const list = original ? terms.map(t => (t.id === original.id ? final : t)) : [...terms, final];
    if (await save({ ...content, glossary: list }, `${original ? 'Edited' : 'Added'} glossary term "${final.termEn}"`)) open(final);
    setBusy(false);
  };

  const remove = async () => {
    if (!original) return setDraft(null);
    if (!window.confirm(`Delete the glossary term "${original.termEn}"? You can restore it from History.`)) return;
    setBusy(true);
    if (await save({ ...content, glossary: terms.filter(t => t.id !== original.id) }, `Deleted glossary term "${original.termEn}"`)) setDraft(null);
    setBusy(false);
  };

  return (
    <section className="grid md:grid-cols-[18rem_1fr] gap-6 items-start">
      <div className="bg-white rounded-2xl border border-sand/50 p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{terms.length} terms</p>
          <Button variant="secondary" onClick={() => open(null)} className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        {!content.glossary && <p className="px-1 pb-2 text-xs text-stone-500">The built-in list. Your first save here stores your own copy.</p>}
        <ul className="max-h-[70vh] overflow-y-auto divide-y divide-sand/40">
          {terms.map(t => (
            <li key={t.id}>
              <button
                onClick={() => open(t)}
                className={`w-full min-h-11 px-2 py-2 text-start text-sm rounded-lg ${originalId === t.id && draft ? 'bg-nile/10 text-nile font-bold' : 'hover:bg-chalk'}`}
              >
                {t.termEn} <span className="font-arabic font-normal text-stone-600" lang="ar">{t.termAr}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!draft ? (
        <p className="text-sm text-stone-500 py-6">
          Pick a term to edit, or add one. The first use of each term in a place’s description is underlined in the app, and tapping it shows the explanation.
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
            {LANGS.map(lang => (
              <div key={lang} className="space-y-3">
                <Field label={`Term (${LANGUAGES[lang].english})${lang === 'en' || lang === 'ar' ? '' : ' (optional)'}`}>
                  <input className={inputClass} lang={lang} dir={LANGUAGES[lang].dir} value={draft[key('term', lang)] ?? ''} onChange={e => set(key('term', lang), e.target.value)} />
                </Field>
                <Field label={`Explanation (${LANGUAGES[lang].english})`} hint={lang === 'en' || lang === 'ar' ? 'One line.' : 'Falls back to English when empty.'}>
                  <textarea className={inputClass} rows={3} lang={lang} dir={LANGUAGES[lang].dir} value={draft[key('def', lang)] ?? ''} onChange={e => set(key('def', lang), e.target.value)} />
                </Field>
                {isOptionalLang(lang) && (
                  <FillMissingButton key={`${session}-${lang}`} lang={lang} missing={missingText(draft, lang, ['term', 'def'])} onFilled={texts => setDraft(d => d && fillEmpty(d, texts, missingKeys(lang)))} />
                )}
              </div>
            ))}
          </div>

          <Field
            label="Spellings to look for"
            hint="One per line, in any language (e.g. sabil, sebil). Case, accents, Arabic vowel marks and “ال” are handled. Avoid Arabic words with everyday meanings, like كتاب."
          >
            <textarea className={inputClass} rows={4} value={spellings} onChange={e => setSpellings(e.target.value)} />
          </Field>

          <div className="rounded-xl bg-chalk/60 p-3 text-xs text-stone-600">
            <p className="font-bold text-stone-500 mb-1">Links in descriptions ({examples.length})</p>
            {examples.length === 0 ? (
              <p>None of the places’ descriptions use these spellings yet.</p>
            ) : (
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {examples.map((x, i) => (
                  <li key={i}>
                    <span className="font-bold" lang={x.lang}>{x.text}</span> · {x.place} ({LANGUAGES[x.lang].english})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {problems.length > 0 && changed && <ErrorBox message="Before saving:" problems={problems} />}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || !changed || problems.length > 0}>
              {original ? 'Save term' : 'Add term'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Close</Button>
            <Button type="button" variant="danger" onClick={remove} disabled={busy} className="ms-auto">
              {original ? 'Delete' : 'Discard'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
