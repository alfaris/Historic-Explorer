import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LANGS, LANGUAGES } from '../i18n/lang';
import { api } from './api';
import { Button, Field, inputClass } from './ui';

export const SUMMARY_KEYS = LANGS.map(l => `summary${LANGUAGES[l].suffix}` as const);
export type SummaryKey = (typeof SUMMARY_KEYS)[number];
type Summarized = Partial<Record<SummaryKey, string>> & {
  nameEn: string;
  descriptionEn?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEs?: string;
};

/**
 * "In short": one line visitors read before the description, in each
 * language. Draft from the description asks Gemini for all four from the
 * descriptions, and fills the empty ones for the admin to check before saving.
 * Key it by the place: a draft for one place mustn't land on another.
 */
export function SummaryFields({ item, onChange, onDraft }: {
  item: Summarized;
  onChange: (key: SummaryKey, value: string) => void;
  /** Gemini's drafts; the editor fills only fields still empty (see fillEmpty). */
  onDraft: (texts: Partial<Record<SummaryKey, string>>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    // Set here too: StrictMode runs the cleanup and setup again on mount.
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const empty = SUMMARY_KEYS.filter(k => !item[k]?.trim());
  const canDraft = !!item.descriptionEn?.trim();
  const draft = async () => {
    setBusy(true);
    setError(null);
    try {
      const descriptions = Object.fromEntries(
        LANGS.map(l => [l, item[`description${LANGUAGES[l].suffix}` as 'descriptionEn']?.trim()]).filter(([, v]) => v),
      );
      const { texts } = await api.summarize(item.nameEn, descriptions);
      if (!mounted.current) return;
      onDraft(Object.fromEntries(SUMMARY_KEYS.filter(k => texts[k]).map(k => [k, texts[k]])));
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div id="summary" className="rounded-xl border border-sand/60 p-4 space-y-3 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-stone-600 me-auto">In short (optional)</p>
        <Button
          type="button"
          variant="secondary"
          className="!py-1.5 !px-3 flex items-center gap-1.5"
          onClick={draft}
          disabled={busy || !canDraft || empty.length === 0}
          title={canDraft ? undefined : 'Write the English description first.'}
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? 'Drafting…' : empty.length === 0 ? 'All written' : 'Draft from the description'}
        </Button>
      </div>
      <p className="text-[11px] text-stone-400">
        One line visitors read before the description, at most 160 characters, e.g. "A 9th-century mosque with Cairo's only spiral minaret, the oldest still standing as built." Draft from the description fills the empty ones with Gemini; check them before saving.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {LANGS.map(lang => {
          const key = `summary${LANGUAGES[lang].suffix}` as SummaryKey;
          return (
            <Field key={key} label={LANGUAGES[lang].english}>
              <textarea value={item[key] ?? ''} onChange={e => onChange(key, e.target.value)} className={inputClass} rows={2} maxLength={160} dir={LANGUAGES[lang].dir} lang={lang} />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
