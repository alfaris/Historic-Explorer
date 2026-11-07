import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Gauge, Loader2, Play, Sparkles } from 'lucide-react';
import { textHash } from '../lib/text-hash';
import { audioGuideUrl } from '../lib/offline-pack';
import { track } from '../lib/track';
import { guidePlayer, nextSpeed, speedLabel, type GuideTrack } from '../lib/guide-player';
import { useContent } from '../data/ContentContext';
import { photoForPlace } from '../data/photo-resolve';
import { LANGUAGES, type Lang } from '../i18n/lang';

import { L, nameOf } from '../i18n/lang';
interface AudioGuideProps {
  locationId: number;
  text: string;
  langCode: Lang;
  /** Walk mode: the lock screen's next and previous buttons move between stops. */
  onNext?: () => void;
  onPrevious?: () => void;
}

const usePlayer = () => {
  const player = guidePlayer();
  return [useSyncExternalStore(player.subscribe, player.getState, player.getState), player] as const;
};

/** A recording (with the script it speaks, when the server kept one), or only the script. */
type GuideAudio = { audio: ArrayBuffer; script: string | null } | { script: string };

/** The narration script sent with a recording (see api/_lib/gemini.ts). */
const transcriptOf = (res: Response): string | null => {
  const raw = res.headers.get('X-Guide-Transcript');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim() || null;
  } catch {
    return null;
  }
};

// Shared across mounts so a prefetch and a later click reuse one request.
const guideCache = new Map<string, Promise<GuideAudio>>();

// The URL includes a hash of the narrated text, so editing a description in
// the admin dashboard gives it a new URL instead of a stale cached recording.
const loadGuideAudio = (locationId: number, langCode: Lang, text: string) => {
  const version = textHash(text);
  const key = `${locationId}:${langCode}:${version}`;
  let pending = guideCache.get(key);
  if (!pending) {
    pending = fetch(audioGuideUrl(locationId, langCode, text)).then(async (res) => {
      if (!res.ok) throw new Error(`Audio guide request failed (${res.status})`);
      if (res.headers.get('Content-Type')?.includes('application/json')) {
        const { script } = await res.json();
        if (!script) throw new Error('No audio returned');
        return { script };
      }
      return { audio: await res.arrayBuffer(), script: transcriptOf(res) };
    });
    guideCache.set(key, pending);
    pending.catch(() => guideCache.delete(key));
  }
  return pending;
};

// Wait this long after a place is opened before generating its audio in the
// background, so quickly skimmed places don't trigger generation.
const PREFETCH_DELAY_MS = 1500;

export function AudioGuide({ locationId, text, langCode, onNext, onPrevious }: AudioGuideProps) {
  const [state, player] = usePlayer();
  // The words of the narration, once the guide has loaded (null for older guides).
  const [transcript, setTranscript] = useState<{ key: string; text: string } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptId = useId();
  // The guide this component shows now: a late answer for an earlier stop (walk mode) is ignored.
  const currentKey = useRef('');
  const { places, routes } = useContent();
  const key = `${locationId}:${langCode}:${textHash(text)}`;
  currentKey.current = key;
  const mine = state.key === key;
  const status = mine ? state.status : 'idle';

  // The walk's next and previous change between renders; the lock screen calls the latest.
  const nav = useRef({ onNext, onPrevious });
  nav.current = { onNext, onPrevious };

  useEffect(() => {
    if (!text) return;
    let active = true;
    setShowTranscript(false);
    const timer = setTimeout(() => {
      loadGuideAudio(locationId, langCode, text)
        .then(result => {
          if (active && result.script) setTranscript({ key, text: result.script });
        })
        .catch(() => {});
    }, PREFETCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const start = async () => {
    if (!text) return;
    track({ t: 'play', id: locationId });
    const place = places.find(p => p.id === locationId);
    const route = place && routes.find(r => r.id === place.routeId);
    const photo = place && photoForPlace(place);
    const t: GuideTrack = {
      key,
      title: place ? nameOf(place) : '',
      artist: route ? nameOf(route) : 'Cairo Walks',
      artwork: photo ? { src: new URL(photo.src, window.location.href).href, width: photo.width, height: photo.height } : undefined,
      onNext: onNext && (() => nav.current.onNext?.()),
      onPrevious: onPrevious && (() => nav.current.onPrevious?.()),
    };
    // Straight from the tap, before any await: iOS only starts audio from a tap.
    const id = player.begin(t);
    // What the browser voice reads if the recording can't play: the narration when there is one.
    let spoken = text;
    try {
      const result = await loadGuideAudio(locationId, langCode, text);
      if (result.script) {
        spoken = result.script;
        if (currentKey.current === key) setTranscript({ key, text: result.script });
      }
      if (!('audio' in result)) {
        // The server could write the narration but not voice it.
        player.playSpeech(id, result.script, langCode);
        return;
      }
      await player.playAudio(id, result.audio);
    } catch (error) {
      console.warn('Audio guide failed, using the browser voice:', error);
      player.playSpeech(id, spoken, langCode);
    }
  };

  // A new place or language stops this guide. After the lock screen's next or
  // previous button (walk mode), the new stop's guide plays on.
  useEffect(() => {
    if (text && player.takeAutoplay()) start();
    return () => player.stop(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'playing') player.stop(key);
    else if (status === 'paused') player.resume();
    else if (status === 'idle') start();
  };

  const busy = status === 'loading';
  const words = transcript?.key === key ? transcript.text : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-sm ${
          status === 'playing'
            ? 'bg-nile text-white shadow-md shadow-nile/30 border border-nile animate-[pulse_3s_ease-in-out_infinite]'
            : busy
              ? 'bg-stone-100 text-stone-500 border border-stone-200 cursor-wait'
              : 'bg-white text-nile hover:bg-stone-50 border border-nile/20 hover:border-nile/50'
        }`}
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
            {L('Loading Immersive Guide', 'جاري التحضير...')}
          </>
        ) : status === 'playing' ? (
          <>
            <div className="flex items-center space-x-1 w-4" aria-hidden="true">
              <div className="w-1 bg-white h-2 animate-[bounce_1s_infinite]"></div>
              <div className="w-1 bg-white h-4 animate-[bounce_1s_infinite_0.2s]"></div>
              <div className="w-1 bg-white h-3 animate-[bounce_1s_infinite_0.4s]"></div>
            </div>
            {L('Stop', 'إيقاف')}
          </>
        ) : status === 'paused' ? (
          <>
            <Play className="w-4 h-4" />
            {L('Resume', 'متابعة')}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {L('Immersive Audio', 'دليل صوتي تفاعلي')}
          </>
        )}
      </button>
      {mine && status !== 'idle' && (
        <button
          onClick={e => {
            e.stopPropagation();
            player.setSpeed(nextSpeed(state.speed));
          }}
          className="inline-flex items-center gap-1.5 min-h-11 min-w-11 px-3 rounded-xl border border-nile/20 bg-white text-xs font-bold text-nile tabular-nums hover:border-nile/50"
          aria-label={`${L('Playback speed', 'سرعة التشغيل')} ${speedLabel(state.speed, langCode)}`}
        >
          <Gauge className="w-4 h-4" aria-hidden="true" />
          {speedLabel(state.speed, langCode)}
        </button>
      )}
      {words && (
        <>
          <button
            onClick={e => {
              e.stopPropagation();
              setShowTranscript(v => !v);
            }}
            aria-expanded={showTranscript}
            aria-controls={transcriptId}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-xs font-bold text-nile hover:bg-nile/5"
          >
            {showTranscript ? L('Hide the transcript', 'إخفاء النص') : L('Read the transcript', 'اقرأ النص')}
            <ChevronDown className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showTranscript && (
            <span
              id={transcriptId}
              lang={langCode}
              dir={LANGUAGES[langCode].dir}
              onClick={e => e.stopPropagation()}
              className="block basis-full text-sm leading-relaxed text-stone-700 bg-stone-50 border border-stone-200 rounded-xl p-4 whitespace-pre-line"
            >
              {words}
            </span>
          )}
        </>
      )}
    </span>
  );
}
