// French and Spanish are optional content: an empty field means the app shows
// the English. These helpers keep empty optional fields out of drafts (so an
// untouched draft still equals the saved content) and draft missing
// translations with Gemini for the admin to review before saving.

import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import type { Location } from '../data/content';
import { LANGUAGES, type OptionalLang } from '../i18n/lang';
import { api } from './api';
import { Button } from './ui';

/** Copy of `obj` with `key` set, or removed when the value is empty ('', [], undefined). */
export function withOptional<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | string | undefined): T {
  const next = { ...obj };
  if (Array.isArray(value) ? value.length : value) (next as Record<keyof T, unknown>)[key] = value;
  else delete next[key];
  return next;
}

/** A content field's key in a language: fieldKey('name', 'es') is 'nameEs'. */
export const fieldKey = <Base extends string>(base: Base, lang: keyof typeof LANGUAGES) => `${base}${LANGUAGES[lang].suffix}` as const;

/** A place's empty fields in `lang`, keyed by field (nameEs, …), with the English to translate. */
export function missingPlaceText(place: Location, lang: OptionalLang): Record<string, string> {
  const missing: Record<string, string> = {};
  const name = fieldKey('name', lang);
  const description = fieldKey('description', lang);
  if (!place[name] && place.nameEn.trim()) missing[name] = place.nameEn;
  if (!place[description] && place.descriptionEn?.trim()) missing[description] = place.descriptionEn;
  return missing;
}

/**
 * Asks Gemini for `lang` versions of `missing` (field → English) and hands
 * them back. Nothing is saved: the admin reviews the drafts and saves.
 */
export function FillMissingButton({ lang, missing, onFilled }: {
  lang: OptionalLang;
  missing: Record<string, string>;
  onFilled: (texts: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const count = Object.keys(missing).length;
  const name = LANGUAGES[lang].english;

  const fill = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { texts } = await api.translate(missing, lang);
      onFilled(texts);
      setMessage({ text: `${name} drafted. Check it, then save.`, error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* type="button": inside the editor form, a plain button would submit (and save) the draft. */}
      <Button type="button" variant="secondary" onClick={fill} disabled={busy || count === 0} className="flex items-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
        {busy ? 'Translating…' : count === 0 ? `${name} complete` : `Fill in missing ${name}`}
      </Button>
      {message && (
        <span className={`text-xs ${message.error ? 'text-red-700' : 'text-stone-500'}`} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </span>
      )}
    </div>
  );
}
