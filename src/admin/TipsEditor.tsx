import React from 'react';
import type { Location } from '../data/content';
import { LANGS, LANGUAGES } from '../i18n/lang';
import { effectiveTips, type Access, type PhotoRule, type VisitorTips } from '../lib/visitor-tips';
import { Field, inputClass } from './ui';
import { fieldKey } from './translations';

/**
 * Visitor tips for a place. The fixed items are worded by the app in every
 * language; only the note is typed per language. Unset tips fall back to the
 * defaults for an active mosque (modest dress, shoes off).
 */
export function TipsEditor({ place, onChange }: { place: Location; onChange: (tips: VisitorTips | undefined) => void }) {
  const tips = effectiveTips(place) ?? {};
  // Every change stores explicit tips, so the defaults stop applying.
  const set = (patch: Partial<VisitorTips>) => {
    const next: Record<string, unknown> = { ...tips, ...patch };
    // Unticked boxes stay as false, so a mosque with everything unticked shows no tips rather than the defaults.
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
    onChange(Object.keys(next).length ? (next as VisitorTips) : undefined);
  };
  const check = (key: 'dress' | 'shoesOff' | 'toilets', label: string) => (
    <label className="flex items-center gap-2 text-sm text-stone-600">
      <input type="checkbox" checked={!!tips[key]} onChange={e => set({ [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div id="tips" className="rounded-xl border border-sand/60 p-4 space-y-3 scroll-mt-24">
      <p className="text-xs font-bold text-stone-600">Visitor tips (optional)</p>
      <p className="text-[11px] text-stone-400">
        Shown to visitors in every language.{' '}
        {place.tips ? 'Set by you.' : effectiveTips(place) ? 'Using the defaults for an active mosque until you change something.' : ''}
      </p>
      <div className="grid sm:grid-cols-3 gap-2">
        {check('dress', 'Modest dress (headscarf for women)')}
        {check('shoesOff', 'Shoes off inside')}
        {check('toilets', 'Toilets on site')}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Photos">
          <select value={tips.photos ?? ''} onChange={e => set({ photos: (e.target.value || undefined) as PhotoRule | undefined })} className={inputClass}>
            <option value="">Not stated</option>
            <option value="yes">Allowed</option>
            <option value="noFlash">Allowed, no flash</option>
            <option value="fee">For a fee</option>
            <option value="no">Not allowed</option>
          </select>
        </Field>
        <Field label="Wheelchair access">
          <select value={tips.wheelchair ?? ''} onChange={e => set({ wheelchair: (e.target.value || undefined) as Access | undefined })} className={inputClass}>
            <option value="">Not stated</option>
            <option value="yes">Step-free</option>
            <option value="partial">Partly step-free</option>
            <option value="no">Not step-free</option>
          </select>
        </Field>
        {LANGS.map(lang => {
          const key = fieldKey('note', lang);
          return (
            <Field key={lang} label={`Note (${LANGUAGES[lang].english})`} hint={lang === 'en' ? 'Optional, e.g. "Enter by the side gate." Other languages show the English when empty.' : undefined}>
              <input value={tips[key] ?? ''} onChange={e => set({ [key]: e.target.value })} className={inputClass} dir={LANGUAGES[lang].dir} lang={lang} maxLength={200} />
            </Field>
          );
        })}
      </div>
    </div>
  );
}
