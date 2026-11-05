import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Volume2 } from 'lucide-react';
import { textHash } from '../lib/text-hash';
import { api, type AudioState } from './api';
import { Button } from './ui';

type Lang = 'en' | 'ar';
const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ar', label: 'Arabic' },
];

/**
 * Shows whether a place's audio guides match its saved descriptions, and
 * generates missing ones. After a save that changes a description, the new
 * audio is generated straight away, so visitors never wait for it.
 */
export function AudioPanel({ placeId, draftText, savedText, generateOnLoad = false }: {
  placeId: number;
  /** The descriptions in the editor (maybe unsaved). */
  draftText: Record<Lang, string>;
  /** The saved descriptions, which visitors hear. */
  savedText: Record<Lang, string>;
  /** Generate missing audio as soon as it loads (a place that was just added). */
  generateOnLoad?: boolean;
}) {
  const [states, setStates] = useState<Record<Lang, AudioState> | null>(null);
  const [busy, setBusy] = useState<Record<Lang, boolean>>({ en: false, ar: false });
  const [error, setError] = useState<string | null>(null);

  const savedVersion = { en: savedText.en ? textHash(savedText.en) : null, ar: savedText.ar ? textHash(savedText.ar) : null };
  const unsaved = { en: draftText.en !== savedText.en, ar: draftText.ar !== savedText.ar };

  const generate = useCallback(async (lang: Lang, version: string) => {
    setBusy(b => ({ ...b, [lang]: true }));
    setError(null);
    try {
      await api.generateAudio(placeId, lang, version);
      setStates(s => (s ? { ...s, [lang]: { status: 'stored', version } } : s));
    } catch (err) {
      setError(`${lang === 'en' ? 'English' : 'Arabic'}: ${(err as Error).message}`);
    } finally {
      setBusy(b => ({ ...b, [lang]: false }));
    }
  }, [placeId]);

  // Load the status whenever the place or its saved text changes. When the
  // saved text changed while this panel was open (i.e. the admin just saved an
  // edit), generate the new audio right away.
  const seen = useRef<{ placeId: number; en: string | null; ar: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    const before = seen.current?.placeId === placeId ? seen.current : null;
    seen.current = { placeId, ...savedVersion };
    api.audioStatus(placeId).then(
      next => {
        if (!active) return;
        setStates(next);
        for (const { lang } of LANGS) {
          const justSaved = before ? before[lang] !== savedVersion[lang] : generateOnLoad;
          if (justSaved && next[lang].status === 'missing' && next[lang].version) generate(lang, next[lang].version!);
        }
      },
      err => active && setError((err as Error).message),
    );
    return () => {
      active = false;
    };
    // savedVersion is derived from savedText; its two parts are the dependencies.
  }, [placeId, savedVersion.en, savedVersion.ar, generate, generateOnLoad]);

  return (
    <div className="rounded-xl border border-sand/60 p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-stone-600 mb-1">
        <Volume2 className="w-4 h-4 text-gold" /> Audio guide
      </p>
      <p className="text-[11px] text-stone-400 mb-3">
        Narrated from the saved description. Editing a description needs new audio, which is made automatically after you save, or here.
      </p>
      <ul className="space-y-2">
        {LANGS.map(({ lang, label }) => {
          const state = states?.[lang];
          let status: React.ReactNode;
          let action: React.ReactNode = null;
          if (!state) status = <span className="text-stone-400">Checking…</span>;
          else if (busy[lang]) status = <span className="flex items-center gap-1.5 text-stone-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating… (about 10–20 s)</span>;
          else if (state.status === 'no-text') status = <span className="text-stone-400">No description</span>;
          else if (state.status === 'unavailable') status = <span className="text-stone-400">No Blob store connected, so audio is made on first play</span>;
          else if (state.status === 'stored') status = <span className="flex items-center gap-1.5 text-nile"><CheckCircle className="w-3.5 h-3.5" /> Ready</span>;
          else {
            status = <span className="text-amber-700">Not generated yet: the next visitor waits for it</span>;
            action = (
              <Button variant="secondary" className="!py-1.5 !px-3" onClick={() => generate(lang, state.version!)}>
                Generate
              </Button>
            );
          }
          return (
            <li key={lang} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-16 text-stone-500">{label}</span>
              <span className="flex-1 min-w-0 text-xs">
                {status}
                {unsaved[lang] && <span className="block text-[11px] text-stone-400">Unsaved edits: the audio follows the saved text until you save.</span>}
              </span>
              {action}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
