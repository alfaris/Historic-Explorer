import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import type { Location } from '../data/content';
import { descriptionOf, LANGS, LANGUAGES, type Lang } from '../i18n/lang';
import { textHash } from '../lib/text-hash';
import { api } from './api';
import { audioCount, generateAllMissing, generateMissing, mapLimit, type AllRunResult, type PlaceAudio, type RunResult } from './route-audio';
import { Button } from './ui';

const resultText = (r: RunResult, lang: Lang) => {
  const name = LANGUAGES[lang].english;
  const made = `${r.generated} ${name} audio guide${r.generated === 1 ? '' : 's'} generated`;
  switch (r.kind) {
    case 'done': return { text: `${made}.`, error: false };
    case 'cancelled': return { text: `Stopped. ${made}.`, error: false };
    case 'limited': return { text: `${made}, then the limit of 30 per 10 minutes was reached. Try again in a few minutes to carry on.`, error: true };
    case 'failed': return { text: `${made}. Stopped at ${r.place}: ${r.message}`, error: true };
  }
};

/**
 * The route editor's audio guides: how many of its places have audio ready in
 * each language, and "Generate missing", which makes the rest one place after
 * another (each takes 10–20 s), so a route is ready before visitors arrive.
 */
export function RouteAudio({ places }: { places: Location[] }) {
  const [audio, setAudio] = useState<PlaceAudio[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState<{ lang: Lang; done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const cancel = useRef(false);

  // Reload when the route's places or their descriptions change (a save elsewhere in the admin).
  const key = textHash(places.map(p => `${p.id}:${LANGS.map(l => descriptionOf(p, l)).join('\u0000')}`).join('\u0001'));
  useEffect(() => {
    let active = true;
    setAudio(null);
    setLoadError(null);
    mapLimit(places, 4, async p => ({ id: p.id, name: p.nameEn, states: await api.audioStatus(p.id) })).then(
      list => active && setAudio(list),
      err => active && setLoadError((err as Error).message),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Leaving the route stops a run (the audio made so far is kept).
  useEffect(() => () => {
    cancel.current = true;
  }, []);

  const run = async (lang: Lang) => {
    if (!audio) return;
    const { missing } = audioCount(audio, lang);
    cancel.current = false;
    setResult(null);
    setRunning({ lang, done: 0, total: missing.length });
    const r = await generateMissing(missing, lang, api.generateAudio, {
      cancelled: () => cancel.current,
      onGenerated: id => {
        setAudio(list => list && list.map(p => (p.id === id ? { ...p, states: { ...p.states, [lang]: { ...p.states[lang], status: 'stored' } } } : p)));
        setRunning(s => s && { ...s, done: s.done + 1 });
      },
    });
    setRunning(null);
    setResult(resultText(r, lang));
  };

  const noStore = audio?.some(p => LANGS.some(l => p.states[l].status === 'unavailable'));

  return (
    <div className="rounded-xl border border-sand/60 p-4">
      <p className="flex items-center gap-2 text-xs font-bold text-stone-600 mb-1">
        <Volume2 className="w-4 h-4 text-gold" aria-hidden="true" /> Audio guides on this route
      </p>
      <p className="text-[11px] text-stone-500 mb-3">
        Places without audio make the first visitor wait while it’s generated. Audio made before transcripts counts as missing, so generating it again adds its transcript. Generate missing makes them one after another (10–20 s each, at most 30 per 10 minutes).
      </p>
      {loadError ? (
        <p className="text-xs text-red-700" role="alert">{loadError}</p>
      ) : !audio ? (
        <p className="flex items-center gap-1.5 text-xs text-stone-500"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Checking {places.length} places…</p>
      ) : noStore ? (
        <p className="text-xs text-stone-500">No Blob store is connected, so audio is made on first play and can’t be generated ahead.</p>
      ) : (
        <ul className="space-y-2">
          {LANGS.map(lang => {
            const { ready, total, missing } = audioCount(audio, lang);
            const mine = running?.lang === lang ? running : null;
            const pct = total ? Math.round((ready / total) * 100) : 100;
            return (
              <li key={lang} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-16 text-stone-600">{LANGUAGES[lang].english}</span>
                <span className="flex-1 min-w-[10rem]">
                  <span className="block text-xs text-stone-600" aria-live={mine ? 'polite' : undefined}>
                    {mine ? `Generating ${mine.done + 1} of ${mine.total}…` : `${ready} of ${total} ready`}
                  </span>
                  <span
                    className="mt-1 block h-1.5 rounded-full bg-sand/40 overflow-hidden"
                    role="progressbar"
                    aria-label={`${LANGUAGES[lang].english} audio: ${ready} of ${total} ready`}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={ready}
                  >
                    <span className={`block h-full rounded-full ${ready === total ? 'bg-nile' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                  </span>
                </span>
                {mine ? (
                  <Button type="button" variant="secondary" className="!py-1.5 !px-3 flex items-center gap-1.5" onClick={() => (cancel.current = true)}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Cancel
                  </Button>
                ) : (
                  // type="button": inside the route form, a plain button would submit (and save) it.
                  <Button type="button" variant="secondary" className="!py-1.5 !px-3" disabled={!!running || missing.length === 0} onClick={() => run(lang)}>
                    {missing.length === 0 ? 'All ready' : `Generate ${missing.length} missing`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {result && <p className={`mt-2 text-xs ${result.error ? 'text-amber-800' : 'text-nile'}`} role={result.error ? 'alert' : 'status'}>{result.text}</p>}
    </div>
  );
}

/** Checks every place's audio (4 at a time), reloading when the places or their descriptions change. */
function usePlaceAudio(places: Location[]) {
  const [audio, setAudio] = useState<PlaceAudio[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const key = textHash(places.map(p => `${p.id}:${LANGS.map(l => descriptionOf(p, l)).join('\u0000')}`).join('\u0001'));
  useEffect(() => {
    let active = true;
    setAudio(null);
    setLoadError(null);
    mapLimit(places, 4, async p => ({ id: p.id, name: p.nameEn, states: await api.audioStatus(p.id) })).then(
      list => active && setAudio(list),
      err => active && setLoadError((err as Error).message),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { audio, setAudio, loadError };
}

const allResultText = (r: AllRunResult, lang: Lang) => {
  const made = `${r.generated} ${LANGUAGES[lang].english} audio guide${r.generated === 1 ? '' : 's'} generated`;
  const failed = r.failures.length ? ` ${r.failures.length} failed: ${r.failures.map(f => `${f.place} (${f.message})`).join('; ')}` : '';
  return { text: `${r.cancelled ? 'Stopped. ' : ''}${made}.${failed}`, error: r.failures.length > 0 };
};

/**
 * "Audio for all routes": the missing guides in each language across every
 * place, and "Generate all missing", which makes them one after another,
 * route by route. At the server's limit it waits a minute and carries on; a
 * place that fails is noted and skipped.
 */
export function AllRoutesAudio({ places }: { places: Location[] }) {
  const { audio, setAudio, loadError } = usePlaceAudio(places);
  const [running, setRunning] = useState<{ lang: Lang; done: number; total: number; paused: boolean } | null>(null);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  const cancel = useRef(false);
  useEffect(() => () => {
    cancel.current = true;
  }, []);

  const run = async (lang: Lang) => {
    if (!audio) return;
    const { missing } = audioCount(audio, lang);
    cancel.current = false;
    setResult(null);
    setRunning({ lang, done: 0, total: missing.length, paused: false });
    const r = await generateAllMissing(missing, lang, api.generateAudio, {
      cancelled: () => cancel.current,
      onGenerated: id => {
        setAudio(list => list && list.map(p => (p.id === id ? { ...p, states: { ...p.states, [lang]: { ...p.states[lang], status: 'stored' } } } : p)));
        setRunning(s => s && { ...s, done: s.done + 1 });
      },
      onPaused: paused => setRunning(s => s && { ...s, paused }),
    });
    setRunning(null);
    setResult(allResultText(r, lang));
  };

  const noStore = audio?.some(p => LANGS.some(l => p.states[l].status === 'unavailable'));

  return (
    <div className="bg-white rounded-2xl border border-sand/50 p-6">
      <p className="flex items-center gap-2 text-sm font-bold text-ink mb-1">
        <Volume2 className="w-4 h-4 text-gold" aria-hidden="true" /> Audio for all routes
      </p>
      <p className="text-xs text-stone-500 mb-3">
        Every place on every route. Generate all missing makes them one after another (10–20 s each). At the limit of 30 per 10 minutes it waits a minute and carries on, so it can run for a while: keep this page open (opening a route stops it). A place that fails is listed at the end, and the rest still get made.
      </p>
      {loadError ? (
        <p className="text-xs text-red-700" role="alert">{loadError}</p>
      ) : !audio ? (
        <p className="flex items-center gap-1.5 text-xs text-stone-500"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Checking {places.length} places…</p>
      ) : noStore ? (
        <p className="text-xs text-stone-500">No Blob store is connected, so audio is made on first play and can’t be generated ahead.</p>
      ) : (
        <ul className="space-y-2">
          {LANGS.map(lang => {
            const { ready, total, missing } = audioCount(audio, lang);
            const mine = running?.lang === lang ? running : null;
            const pct = total ? Math.round((ready / total) * 100) : 100;
            return (
              <li key={lang} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-16 text-stone-600">{LANGUAGES[lang].english}</span>
                <span className="flex-1 min-w-[10rem]">
                  <span className="block text-xs text-stone-600" aria-live={mine ? 'polite' : undefined}>
                    {mine
                      ? mine.paused
                        ? `Waiting a minute for the limit (${mine.done} of ${mine.total} done)…`
                        : `Generating ${mine.done + 1} of ${mine.total}…`
                      : `${ready} of ${total} ready`}
                  </span>
                  <span
                    className="mt-1 block h-1.5 rounded-full bg-sand/40 overflow-hidden"
                    role="progressbar"
                    aria-label={`${LANGUAGES[lang].english} audio, all routes: ${ready} of ${total} ready`}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={ready}
                  >
                    <span className={`block h-full rounded-full ${ready === total ? 'bg-nile' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
                  </span>
                </span>
                {mine ? (
                  <Button type="button" variant="secondary" className="!py-1.5 !px-3 flex items-center gap-1.5" onClick={() => (cancel.current = true)}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Stop
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="!py-1.5 !px-3" disabled={!!running || missing.length === 0} onClick={() => run(lang)}>
                    {missing.length === 0 ? 'All ready' : `Generate all ${missing.length} missing`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {result && <p className={`mt-2 text-xs ${result.error ? 'text-amber-800' : 'text-nile'}`} role={result.error ? 'alert' : 'status'}>{result.text}</p>}
    </div>
  );
}
