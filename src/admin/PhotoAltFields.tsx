import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LANGS, LANGUAGES } from '../i18n/lang';
import { api } from './api';
import { Button, Field, inputClass } from './ui';

export const PHOTO_ALT_KEYS = LANGS.map(l => `photoAlt${LANGUAGES[l].suffix}` as const);
export type PhotoAltKey = (typeof PHOTO_ALT_KEYS)[number];
type WithAlts = Partial<Record<PhotoAltKey, string>>;

/** `item` without its photo descriptions: they describe a photo that's being replaced or removed. */
export function withoutPhotoAlts<T extends WithAlts>(item: T): T {
  const next = { ...item };
  for (const key of PHOTO_ALT_KEYS) delete next[key];
  return next;
}

/**
 * "What the photo shows", for screen readers, in each language, under the
 * photo in the place and route editors. Draft with Gemini looks at the photo
 * and fills the empty ones, for the admin to check before saving.
 */
export function PhotoAltFields({ item, src, name, onChange }: {
  item: WithAlts;
  /** The photo shown (uploaded or built in); nothing to describe without one. */
  src: string | undefined;
  name: string;
  onChange: (key: PhotoAltKey, value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The editor may move to another place while Gemini is answering.
  const current = useRef(src);
  current.current = src;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  if (!src) return null;

  const empty = PHOTO_ALT_KEYS.filter(k => !item[k]?.trim());
  const draft = async () => {
    setBusy(true);
    setError(null);
    try {
      const { texts } = await api.describePhoto(src, name);
      if (!mounted.current || current.current !== src) return;
      for (const key of PHOTO_ALT_KEYS) if (texts[key] && !item[key]?.trim()) onChange(key, texts[key]);
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-sand/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-stone-600 me-auto">What the photo shows (for screen readers)</p>
        <Button type="button" variant="secondary" className="!py-1.5 !px-3 flex items-center gap-1.5" onClick={draft} disabled={busy || empty.length === 0}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {busy ? 'Looking at the photo…' : empty.length === 0 ? 'All described' : 'Draft with Gemini'}
        </Button>
      </div>
      <p className="text-[11px] text-stone-400">
        One sentence, e.g. "The carved stone façade, with a shell-shaped niche above the door." Without one, screen readers hear the name. Draft with Gemini fills the empty ones; check them before saving.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {LANGS.map(lang => {
          const key = `photoAlt${LANGUAGES[lang].suffix}` as PhotoAltKey;
          return (
            <Field key={key} label={LANGUAGES[lang].english}>
              <textarea
                value={item[key] ?? ''}
                onChange={e => onChange(key, e.target.value)}
                className={inputClass}
                rows={2}
                maxLength={250}
                dir={LANGUAGES[lang].dir}
                lang={lang}
              />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
