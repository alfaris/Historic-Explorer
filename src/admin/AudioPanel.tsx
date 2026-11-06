import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Volume2 } from 'lucide-react';
import { textHash } from '../lib/text-hash';
import { api, type AudioState } from './api';
import { Button } from './ui';

import { LANGS as LANG_IDS, LANGUAGES, type Lang } from '../i18n/lang';

const LANGS: { lang: Lang; label: string }[] = LANG_IDS.map(lang => ({ lang, label: LANGUAGES[lang].english }));
const byLangKey = <T,>(f: (lang: Lang) => T) => Object.fromEntries(LANG_IDS.map(l => [l, f(l)])) as Record<Lang, T>;
const hashOf = (text: string) => (text ? textHash(text) : null);

/**
 * Shows whether a place's audio guides match its saved descriptions, and
 * generates missing ones. After a save that changes a description, the new
 * audio is generated straight away, so visitors never wait for it.
 */
export function AudioPanel({ placeId, draftText, savedText, generateOnLoad = false }: {
  placeId: number;
  /** The text each language is narrated from, in the editor (maybe unsaved). French and Spanish fall back to English. */
  draftText: Record<Lang, string>;
  /** The saved descriptions, which visitors hear. */
  savedText: Record<Lang, string>;
  /** Generate missing audio as soon as it loads (a place that was just added). */
  generateOnLoad?: boolean;
}) {
  const [states, setStates] = useState<Record<Lang, AudioState> | null>(null);
  const [busy, setBusy] = useState<Record<Lang, boolean>>(() => byLangKey(() => false));
  const [error, setError] = useState<string | null>(null);

  const savedVersion = byLangKey(l => hashOf(savedText[l]));
  const unsaved = byLangKey(l => draftText[l] !== savedText[l]);

  const generate = useCallback(async (lang: Lang, version: string) => {
    setBusy(b => ({ ...b, [lang]: true }));
    setError(null);
    try {
      await api.generateAudio(placeId, lang, version);
      // Only if the panel still shows that text: a result for older text must
      // not mark the current text as ready.
      setStates(s => (s && s[lang].version === version ? { ...s, [lang]: { status: 'stored', version } } : s));
    } catch (err) {
      setError(`${LANGS.find(l => l.lang === lang)!.label}: ${(err as Error).message}`);
    } finally {
      setBusy(b => ({ ...b, [lang]: false }));
    }
  }, [placeId]);

  // Load the status whenever the place or its saved text changes. When the
  // saved text changed while this panel was open (i.e. the admin just saved an
  // edit), generate the new audio right away.
  const seen = useRef<({ placeId: number } & Record<Lang, string | null>) | null>(null);
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
    // savedVersion is derived from savedText; its parts (joined) are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, LANG_IDS.map(l => savedVersion[l]).join('|'), generate, generateOnLoad]);

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
              // type="button": inside the place form, a plain button would submit (and save) the draft.
              <Button type="button" variant="secondary" className="!py-1.5 !px-3" onClick={() => generate(lang, state.version!)}>
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
