import { describe, expect, it, vi } from 'vitest';
import { SPEED_KEY, createGuidePlayer, nextSpeed, readSpeed, speedLabel, type AudioLike, type UtteranceLike } from './guide-player';

// A fake <audio> that plays when asked and fires the events the player listens to.
function fakeAudio() {
  const handlers: Record<string, (() => void)[]> = {};
  const fire = (t: string) => (handlers[t] ?? []).forEach(fn => fn());
  const a: AudioLike & { fire: typeof fire; failNext: boolean } = {
    src: '', currentTime: 0, duration: 60, playbackRate: 1, defaultPlaybackRate: 1, ended: false, paused: true, preload: '',
    failNext: false,
    play: vi.fn(async () => {
      if (a.failNext) { a.failNext = false; throw new Error('NotAllowedError'); }
      a.paused = false;
      fire('playing');
    }),
    pause: vi.fn(() => { a.paused = true; fire('pause'); }),
    load: vi.fn(),
    removeAttribute: vi.fn(() => { a.src = ''; }),
    addEventListener: (t, fn) => { (handlers[t] ??= []).push(fn); },
    fire,
  };
  return a;
}

function setup(stored: string | null = null) {
  const audio = fakeAudio();
  const spoken: UtteranceLike[] = [];
  const texts: string[] = [];
  const store = new Map<string, string>(stored ? [[SPEED_KEY, stored]] : []);
  const actions = new Map<string, unknown>();
  const session = {
    metadata: null as unknown,
    playbackState: 'none',
    setActionHandler: (a: string, fn: unknown) => { fn ? actions.set(a, fn) : actions.delete(a); },
    setPositionState: vi.fn(),
  };
  const speech = { speak: vi.fn((u: UtteranceLike) => spoken.push(u)), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [] };
  const player = createGuidePlayer({
    createAudio: () => audio,
    speech,
    createUtterance: text => { texts.push(text); return { lang: '', rate: 1, voice: null, onend: null, onerror: null, onboundary: null }; },
    mediaSession: session,
    createMetadata: init => init,
    storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    createObjectURL: () => `blob:${Math.random()}`,
    revokeObjectURL: () => {},
  });
  return { player, audio, speech, spoken, texts, store, session, actions };
}

const track = (key: string, extra = {}) => ({ key, title: 'Al-Azhar Mosque', artist: 'Al-Muizz Street', ...extra });
const wav = new ArrayBuffer(8);

describe('speeds', () => {
  it('reads a stored speed, falling back to 1', () => {
    expect(readSpeed('1.25')).toBe(1.25);
    expect(readSpeed('2')).toBe(1);
    expect(readSpeed(null)).toBe(1);
  });
  it('cycles 1 → 1.25 → 1.5 → 0.75 → 1', () => {
    expect([1, 1.25, 1.5, 0.75].map(s => nextSpeed(s as never))).toEqual([1.25, 1.5, 0.75, 1]);
  });
  it('writes a decimal comma in French and Spanish', () => {
    expect(speedLabel(1.25, 'en')).toBe('1.25×');
    expect(speedLabel(1.25, 'fr')).toBe('1,25×');
    expect(speedLabel(1, 'es')).toBe('1×');
  });
});

describe('guide player', () => {
  it('plays a recorded guide at the saved speed and shows it on the lock screen', async () => {
    const { player, audio, session, actions } = setup('1.5');
    const id = player.begin(track('a'));
    expect(player.getState()).toMatchObject({ key: 'a', status: 'loading' });
    await player.playAudio(id, wav);
    expect(player.getState()).toMatchObject({ key: 'a', status: 'playing', mode: 'audio', speed: 1.5 });
    expect(audio.playbackRate).toBe(1.5);
    expect(session.metadata).toMatchObject({ title: 'Al-Azhar Mosque', artist: 'Al-Muizz Street', album: 'Cairo Walks' });
    expect(session.playbackState).toBe('playing');
    expect([...actions.keys()].sort()).toEqual(['pause', 'play', 'seekbackward', 'seekforward', 'seekto', 'stop']);
  });

  it('pauses, resumes and seeks from the lock screen', async () => {
    const { player, audio, session, actions } = setup();
    const id = player.begin(track('a'));
    await player.playAudio(id, wav);
    (actions.get('pause') as () => void)();
    expect(player.getState().status).toBe('paused');
    expect(session.playbackState).toBe('paused');
    (actions.get('play') as () => void)();
    await Promise.resolve();
    expect(player.getState().status).toBe('playing');
    audio.currentTime = 5;
    (actions.get('seekbackward') as (d: object) => void)({});
    expect(audio.currentTime).toBe(0);
    (actions.get('seekforward') as (d: object) => void)({});
    expect(audio.currentTime).toBe(10);
  });

  it('changes speed while playing and remembers it', async () => {
    const { player, audio, store } = setup();
    const id = player.begin(track('a'));
    await player.playAudio(id, wav);
    player.setSpeed(1.25);
    expect(audio.playbackRate).toBe(1.25);
    expect(store.get(SPEED_KEY)).toBe('1.25');
  });

  it('ignores a recording that arrives after another guide was started', async () => {
    const { player } = setup();
    const first = player.begin(track('a'));
    player.begin(track('b'));
    await player.playAudio(first, wav);
    expect(player.getState()).toMatchObject({ key: 'b', status: 'loading', mode: null });
  });

  it('ignores the silent unlock clip and clears the lock screen when the guide ends', async () => {
    const { player, audio, session, actions } = setup();
    const id = player.begin(track('a'));
    audio.fire('playing'); // the silent clip
    expect(player.getState().status).toBe('loading');
    await player.playAudio(id, wav);
    audio.ended = true;
    audio.fire('ended');
    expect(player.getState()).toMatchObject({ key: null, status: 'idle' });
    expect(session.metadata).toBeNull();
    expect(actions.size).toBe(0);
  });

  it('ignores an earlier start of the same guide whose recording arrives late', async () => {
    const { player, audio } = setup();
    const first = player.begin(track('a'));
    player.begin(track('b'));
    const again = player.begin(track('a'));
    // Both starts of guide A get the same recording: the first one changes nothing.
    const src = audio.src;
    await expect(player.playAudio(first, wav)).resolves.toBeUndefined();
    expect(audio.src).toBe(src);
    await player.playAudio(again, wav);
    expect(player.getState()).toMatchObject({ key: 'a', status: 'playing', mode: 'audio' });
  });

  it('stops only the guide that asks, so another guide keeps playing', async () => {
    const { player } = setup();
    const id = player.begin(track('a'));
    await player.playAudio(id, wav);
    player.stop('b');
    expect(player.getState().key).toBe('a');
    player.stop('a');
    expect(player.getState().status).toBe('idle');
  });

  it('throws when audio is blocked, so the guide can fall back to the browser voice', async () => {
    const { player, audio } = setup();
    const id = player.begin(track('a'));
    audio.failNext = true;
    await expect(player.playAudio(id, wav)).rejects.toThrow();
    expect(player.getState()).toMatchObject({ key: 'a', mode: null });
  });

  it('reads with the browser voice at the chosen speed, and carries on from the last word when the speed changes', () => {
    const { player, spoken, texts, actions } = setup('0.75');
    const id = player.begin(track('a'));
    player.playSpeech(id, 'One two three four', 'en');
    expect(player.getState()).toMatchObject({ status: 'playing', mode: 'speech' });
    expect(spoken[0]).toMatchObject({ rate: 0.75, lang: 'en-US' });
    expect(actions.has('seekforward')).toBe(false);
    spoken[0].onboundary!({ charIndex: 8 });
    player.setSpeed(1.5);
    expect(texts[1]).toBe('three four');
    expect(spoken[1].rate).toBe(1.5);
    // The first utterance ending (it was cancelled) changes nothing; the second ending stops.
    spoken[0].onend!();
    expect(player.getState().status).toBe('playing');
    spoken[1].onend!();
    expect(player.getState().status).toBe('idle');
  });

  it('resumes the voice when the speed changes while it is paused', () => {
    const { player, speech, spoken, actions } = setup();
    const id = player.begin(track('a'));
    player.playSpeech(id, 'One two three four', 'en');
    (actions.get('pause') as () => void)();
    expect(player.getState().status).toBe('paused');
    speech.resume.mockClear();
    player.setSpeed(1.25);
    expect(speech.resume).toHaveBeenCalled();
    expect(spoken).toHaveLength(2);
    expect(player.getState().status).toBe('playing');
  });

  it('offers next and previous in walk mode, and lets the next guide play on', async () => {
    const { player, actions } = setup();
    const onNext = vi.fn();
    const id = player.begin(track('a', { onNext }));
    await player.playAudio(id, wav);
    expect(actions.has('nexttrack')).toBe(true);
    expect(actions.has('previoustrack')).toBe(false);
    expect(player.takeAutoplay()).toBe(false);
    (actions.get('nexttrack') as () => void)();
    expect(onNext).toHaveBeenCalled();
    expect(player.takeAutoplay()).toBe(true);
    expect(player.takeAutoplay()).toBe(false);
  });
});
