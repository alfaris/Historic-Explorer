// French is optional content: an empty French field means the app shows the
// English. These helpers keep empty French fields out of drafts (so an
// untouched draft still equals the saved content) and draft missing French
// with Gemini for the admin to review before saving.

import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import type { Location } from '../data/content';
import { api } from './api';
import { Button } from './ui';

/** Copy of `obj` with `key` set, or removed when the value is empty. */
export function withOptional<T extends object>(obj: T, key: keyof T, value: string | string[] | undefined): T {
  const next = { ...obj };
  if (Array.isArray(value) ? value.length : value) (next as Record<keyof T, unknown>)[key] = value;
  else delete next[key];
  return next;
}

/** A place's French fields that are empty, keyed by field, with the English to translate. */
export function missingPlaceFrench(place: Location): Record<string, string> {
  const missing: Record<string, string> = {};
  if (!place.nameFr && place.nameEn.trim()) missing.nameFr = place.nameEn;
  if (!place.descriptionFr && place.descriptionEn?.trim()) missing.descriptionFr = place.descriptionEn;
  return missing;
}

/**
 * Asks Gemini for French versions of `missing` (field → English) and hands
 * them back. Nothing is saved: the admin reviews the drafts and saves.
 */
export function FillFrenchButton({ missing, onFilled }: {
  missing: Record<string, string>;
  onFilled: (texts: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const count = Object.keys(missing).length;

  const fill = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { texts } = await api.translate(missing);
      onFilled(texts);
      setMessage({ text: 'French drafted. Check it, then save.', error: false });
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
        {busy ? 'Translating…' : count === 0 ? 'French complete' : 'Fill in missing French'}
      </Button>
      {message && (
        <span className={`text-xs ${message.error ? 'text-red-700' : 'text-stone-500'}`} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </span>
      )}
    </div>
  );
}
