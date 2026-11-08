// One player for every audio guide in the app. Guides play through a single
// <audio> element rather than Web Audio, so phones show them on the lock
// screen and in the notification shade (Media Session), keep playing with the
// screen off, and can change speed and seek. Only one guide plays at a time.
// When the server could only write a script, or audio fails, the browser's
// own voice reads it at the same speed.
//
// The browser APIs are passed in (createGuidePlayer), so the logic is tested
// with fakes; `guidePlayer()` builds the app's one instance from the real ones.

import { LANGUAGES, type Lang } from '../i18n/lang.js';

export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];
export const SPEED_KEY = 'cw:audio-speed';
/** How far the lock screen's skip buttons jump, in seconds. */
export const SEEK_SECONDS = 10;

/** A stored speed, or 1 when there's none or it isn't one of SPEEDS. */
export const readSpeed = (stored: string | null | undefined): Speed => {
  const n = Number(stored);
  return (SPEEDS as readonly number[]).includes(n) ? (n as Speed) : 1;
};

/** The next speed on the button: 1 → 1.25 → 1.5 → 0.75 → 1. */
export const nextSpeed = (s: Speed): Speed => {
  const order: Speed[] = [1, 1.25, 1.5, 0.75];
  return order[(order.indexOf(s) + 1) % order.length];
};

/** "1.25×", or "1,25×" in French and Spanish. */
export const speedLabel = (s: Speed, lang: Lang) => `${lang === 'fr' || lang === 'es' ? String(s).replace('.', ',') : s}×`;

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export interface PlayerState {
  /** Which guide the player belongs to (null when idle). */
  key: string | null;
  status: PlayerStatus;
  /** 'audio' for the recorded guide, 'speech' for the browser's voice. */
  mode: 'audio' | 'speech' | null;
  speed: Speed;
}

export interface GuideTrack {
  key: string;
  title: string;
  artist: string;
  /** Absolute URL of a picture for the lock screen. */
  artwork?: { src: string; width: number; height: number };
  /** Walk mode: the lock screen's next and previous buttons move between stops. */
  onNext?: () => void;
  onPrevious?: () => void;
}

// The slices of browser APIs the player uses.
export interface AudioLike {
  src: string;
  currentTime: number;
  duration: number;
  playbackRate: number;
  defaultPlaybackRate: number;
  ended: boolean;
  paused: boolean;
  preload: string;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, fn: () => void): void;
}
export interface UtteranceLike {
  lang: string;
  rate: number;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onboundary: ((e: { charIndex: number }) => void) | null;
}
export interface SpeechLike {
  speak(u: UtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): { lang: string }[];
}
export interface MediaSessionLike {
  metadata: unknown;
  playbackState: string;
  setActionHandler(action: string, handler: ((details: { seekOffset?: number; seekTime?: number }) => void) | null): void;
  setPositionState?(state?: { duration: number; playbackRate: number; position: number }): void;
}
export interface PlayerEnv {
  createAudio(): AudioLike;
  speech?: SpeechLike;
  createUtterance?(text: string): UtteranceLike;
  mediaSession?: MediaSessionLike;
  createMetadata?(init: { title: string; artist: string; album: string; artwork: { src: string; sizes: string; type?: string }[] }): unknown;
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

// A tenth of a second of silence, played straight away when a guide is tapped:
// iOS only lets audio start from a tap, and the real recording arrives later.
function silentWav(): Blob {
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  return new Blob([buf], { type: 'audio/wav' });
}

export function createGuidePlayer(env: PlayerEnv) {
  let state: PlayerState = {
    key: null,
    status: 'idle',
    mode: null,
    speed: readSpeed((() => { try { return env.storage?.getItem(SPEED_KEY); } catch { return null; } })()),
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn());
    syncSession();
  };

  let track: GuideTrack | null = null;
  // Each start of a guide gets a number, so a recording that arrives for an
  // earlier start (even of the same guide) can't touch a later one.
  let attempt = 0;
  let audio: AudioLike | null = null;
  let url: string | null = null;
  let silentUrl: string | null = null;
  // When the lock screen's next or previous button was pressed (the next guide shown plays on).
  let autoplayAt = 0;
  // Browser voice: what's being read, from where, and the utterance that counts.
  let speech: { text: string; offset: number; lang: Lang; utterance: UtteranceLike | null; onBlocked?: () => void } | null = null;

  const releaseUrl = () => {
    if (url) env.revokeObjectURL(url);
    url = null;
  };

  const el = (): AudioLike => {
    if (audio) return audio;
    const a = env.createAudio();
    a.preload = 'auto';
    // Events from the silent unlock clip are ignored: mode is set to 'audio' only for a guide.
    a.addEventListener('playing', () => state.mode === 'audio' && set({ status: 'playing' }));
    a.addEventListener('pause', () => state.mode === 'audio' && state.status === 'playing' && !a.ended && set({ status: 'paused' }));
    a.addEventListener('ended', () => state.mode === 'audio' && stop());
    for (const e of ['loadedmetadata', 'ratechange', 'seeked']) a.addEventListener(e, () => state.mode === 'audio' && syncPosition());
    audio = a;
    return a;
  };

  const syncPosition = () => {
    const a = audio;
    if (!a || !env.mediaSession?.setPositionState || !Number.isFinite(a.duration) || a.duration <= 0) return;
    try {
      env.mediaSession.setPositionState({ duration: a.duration, playbackRate: a.playbackRate, position: Math.min(a.currentTime, a.duration) });
    } catch { /* Some browsers reject position updates mid-load. */ }
  };

  const handler = (action: string, fn: ((d: { seekOffset?: number; seekTime?: number }) => void) | null) => {
    try { env.mediaSession?.setActionHandler(action, fn); } catch { /* Action not supported here. */ }
  };

  // Keep the lock screen in step with the player.
  let sessionKey: string | null = null;
  const syncSession = () => {
    const ms = env.mediaSession;
    if (!ms) return;
    if (!state.key || state.status === 'idle') {
      if (sessionKey) {
        ms.metadata = null;
        ms.playbackState = 'none';
        for (const a of ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack']) handler(a, null);
        sessionKey = null;
      }
      return;
    }
    ms.playbackState = state.status === 'paused' ? 'paused' : 'playing';
    const sessionId = `${state.key}:${state.mode}`;
    if (sessionKey === sessionId || !track) return;
    sessionKey = sessionId;
    if (env.createMetadata) {
      ms.metadata = env.createMetadata({
        title: track.title,
        artist: track.artist,
        album: 'Cairo Walks',
        artwork: track.artwork ? [{ src: track.artwork.src, sizes: `${track.artwork.width}x${track.artwork.height}` }] : [],
      });
    }
    handler('play', () => resume());
    handler('pause', () => pause());
    handler('stop', () => stop());
    const seekable = state.mode === 'audio';
    handler('seekbackward', seekable ? d => seekBy(-(d.seekOffset ?? SEEK_SECONDS)) : null);
    handler('seekforward', seekable ? d => seekBy(d.seekOffset ?? SEEK_SECONDS) : null);
    handler('seekto', seekable ? d => { if (audio && d.seekTime != null) { audio.currentTime = d.seekTime; syncPosition(); } } : null);
    const skip = (fn?: () => void) => (fn ? () => { autoplayAt = Date.now(); fn(); } : null);
    handler('previoustrack', skip(track.onPrevious));
    handler('nexttrack', skip(track.onNext));
  };

  const cancelSpeech = () => {
    if (!speech) return;
    speech.utterance = null;
    speech = null;
    env.speech?.cancel();
  };

  const speakFrom = (offset: number) => {
    if (!speech || !env.speech || !env.createUtterance) return;
    const u = env.createUtterance(speech.text.slice(offset));
    u.lang = LANGUAGES[speech.lang].speech;
    u.rate = state.speed;
    const voice = env.speech.getVoices().find(v => v.lang.toLowerCase().startsWith(speech!.lang));
    if (voice) u.voice = voice;
    speech.offset = offset;
    speech.utterance = u;
    u.onboundary = e => { if (speech?.utterance === u) speech.offset = offset + e.charIndex; };
    u.onend = () => { if (speech?.utterance === u) stop(); };
    // Some browsers report "interrupted" though speech carries on; only a real error stops.
    u.onerror = e => {
      if (speech?.utterance !== u || e.error === 'interrupted' || e.error === 'canceled') return;
      // The browser refused to speak without a tap: say so, for a "Tap to play".
      const blocked = e.error === 'not-allowed' ? speech.onBlocked : undefined;
      stop();
      blocked?.();
    };
    env.speech.cancel();
    // Cancelling doesn't lift a pause: resume, or the new utterance waits silently.
    env.speech.resume();
    env.speech.speak(u);
  };

  /** Stops whatever is playing. With a key, only if that guide is the one playing. */
  function stop(key?: string) {
    if (key && key !== state.key) return;
    attempt++;
    track = null;
    const wasAudio = state.mode;
    set({ key: null, status: 'idle', mode: null });
    if (audio && (wasAudio === 'audio' || !audio.paused)) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    releaseUrl();
    cancelSpeech();
  }

  function pause() {
    if (state.status !== 'playing') return;
    if (state.mode === 'audio') audio?.pause();
    else if (state.mode === 'speech') {
      env.speech?.pause();
      set({ status: 'paused' });
    }
  }

  function resume() {
    if (state.status !== 'paused') return;
    if (state.mode === 'audio') audio?.play().catch(() => {});
    else if (state.mode === 'speech') {
      env.speech?.resume();
      set({ status: 'playing' });
    }
  }

  function seekBy(seconds: number) {
    if (!audio || state.mode !== 'audio') return;
    const end = Number.isFinite(audio.duration) ? audio.duration : Infinity;
    audio.currentTime = Math.max(0, Math.min(end, audio.currentTime + seconds));
    syncPosition();
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Call straight from the tap that starts a guide: stops anything else,
     * shows it loading, and unlocks audio on iOS with a moment of silence.
     * Returns this start's number, for playAudio and playSpeech.
     */
    begin(t: GuideTrack): number {
      stop();
      const id = attempt;
      track = t;
      set({ key: t.key, status: 'loading', mode: null });
      const a = el();
      try {
        silentUrl ??= env.createObjectURL(silentWav());
        a.src = silentUrl;
        a.play().catch(() => {});
      } catch { /* No Blob support: the real play() below may still work. */ }
      return id;
    },

    /** Plays the recorded guide, if start `id` is still the current one. Throws if it can't play. */
    async playAudio(id: number, data: ArrayBuffer) {
      if (id !== attempt) return;
      const a = el();
      releaseUrl();
      url = env.createObjectURL(new Blob([data], { type: 'audio/wav' }));
      set({ mode: 'audio' });
      a.src = url;
      a.defaultPlaybackRate = state.speed;
      a.playbackRate = state.speed;
      try {
        await a.play();
      } catch (err) {
        // A newer start replaced this one (which aborts its play()): not a failure.
        if (id !== attempt) return;
        set({ mode: null });
        releaseUrl();
        throw err;
      }
    },

    /**
     * Reads the text with the browser's voice, if start `id` is still the
     * current one. `onBlocked` is called if the browser refuses to speak
     * without a tap (it stops first).
     */
    playSpeech(id: number, text: string, lang: Lang, onBlocked?: () => void) {
      if (id !== attempt) return;
      if (!env.speech || !env.createUtterance) {
        stop();
        return;
      }
      if (audio && state.mode !== 'audio') audio.pause();
      cancelSpeech();
      speech = { text, offset: 0, lang, utterance: null, onBlocked };
      set({ mode: 'speech', status: 'playing' });
      speakFrom(0);
    },

    stop,
    pause,
    resume,
    seekBy,

    setSpeed(speed: Speed) {
      try { env.storage?.setItem(SPEED_KEY, String(speed)); } catch { /* Private mode: just this visit. */ }
      set({ speed });
      if (audio && state.mode === 'audio') {
        audio.defaultPlaybackRate = speed;
        audio.playbackRate = speed;
      }
      // The browser's voice can't change speed mid-sentence: carry on from the last word at the new speed.
      if (speech && state.mode === 'speech') {
        const wasPaused = state.status === 'paused';
        speakFrom(speech.offset);
        if (wasPaused) set({ status: 'playing' });
      }
    },

    /** True once, just after the lock screen's next or previous button, so the guide shown next plays on. */
    takeAutoplay() {
      const fresh = Date.now() - autoplayAt < 3000;
      autoplayAt = 0;
      return fresh;
    },
  };
}

export type GuidePlayer = ReturnType<typeof createGuidePlayer>;

let instance: GuidePlayer | null = null;

/** The app's player, built from the browser's APIs on first use. */
export function guidePlayer(): GuidePlayer {
  if (instance) return instance;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  instance = createGuidePlayer({
    createAudio: () => new Audio() as unknown as AudioLike,
    speech: hasSpeech ? (window.speechSynthesis as unknown as SpeechLike) : undefined,
    createUtterance: hasSpeech ? text => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike : undefined,
    mediaSession: nav && 'mediaSession' in nav ? (nav.mediaSession as unknown as MediaSessionLike) : undefined,
    createMetadata: typeof MediaMetadata !== 'undefined' ? init => new MediaMetadata(init) : undefined,
    storage: (() => { try { return window.localStorage; } catch { return undefined; } })(),
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: u => URL.revokeObjectURL(u),
  });
  return instance;
}
