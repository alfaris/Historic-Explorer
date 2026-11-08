import React from 'react';
import { Sparkles } from 'lucide-react';
import { LANGS, LANGUAGES } from '../i18n/lang';
import { draftedOf, withoutDrafted } from '../lib/drafted';

const BASES: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  highlights: 'Highlights',
  fee: 'Entry fee',
  spot: 'Spot it challenge',
  spotAnswer: 'Spot it answer',
  photoAlt: 'Photo description',
  metro: 'Nearest metro',
  gettingThere: 'Getting there note',
  term: 'Term',
  def: 'Explanation',
};

/** "Description (French)" for "descriptionFr". */
export function draftLabel(key: string): string {
  for (const l of LANGS) {
    const suffix = LANGUAGES[l].suffix;
    if (key.endsWith(suffix)) {
      const base = key.slice(0, -suffix.length);
      return `${BASES[base] ?? base} (${LANGUAGES[l].english})`;
    }
  }
  return BASES[key] ?? key;
}

/**
 * The fields Gemini drafted in this item that no one has checked yet, each
 * with Mark reviewed. Editing a field by hand also counts as reviewed. The
 * marks are saved with the item; visitors never see them.
 */
export function DraftReview<T extends object>({ item, onChange }: { item: T; onChange: (next: T) => void }) {
  const keys = draftedOf(item);
  if (!keys.length) return null;
  return (
    <div className="rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm" role="note">
      <p className="flex items-center gap-2 font-bold text-ink">
        <Sparkles className="w-4 h-4 text-gold-ink" aria-hidden="true" />
        Drafted by Gemini, not reviewed yet
      </p>
      <p className="mt-0.5 text-xs text-stone-600">Check each one below. Editing it, or Mark reviewed, takes it off this list (and the Content checklist) once saved.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {keys.map(k => (
          <li key={k} className="flex items-center gap-1 rounded-full bg-white border border-sand ps-3 text-xs">
            <span>{draftLabel(k)}</span>
            <button type="button" onClick={() => onChange(withoutDrafted(item, [k]))} className="min-h-9 px-3 rounded-full font-bold text-nile hover:bg-nile/10">
              Mark reviewed
            </button>
          </li>
        ))}
      </ul>
      {keys.length > 1 && (
        <button type="button" onClick={() => onChange(withoutDrafted(item, keys))} className="mt-2 min-h-11 px-2 text-xs font-bold text-nile underline underline-offset-4">
          Mark all reviewed
        </button>
      )}
    </div>
  );
}
