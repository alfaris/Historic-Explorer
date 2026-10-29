import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface AudioGuideProps {
  locationId: number;
  text: string;
  langCode: 'en' | 'ar';
}

type GuideAudio = { audio: ArrayBuffer } | { script: string };

// Shared across mounts so a prefetch and a later click reuse one request.
const guideCache = new Map<string, Promise<GuideAudio>>();

const loadGuideAudio = (locationId: number, langCode: 'en' | 'ar') => {
  const key = `${locationId}:${langCode}`;
  let pending = guideCache.get(key);
  if (!pending) {
    pending = fetch(`/api/audio-guide?id=${locationId}&lang=${langCode}`).then(async (res) => {
      if (!res.ok) throw new Error(`Audio guide request failed (${res.status})`);
      if (res.headers.get('Content-Type')?.includes('application/json')) {
        const { script } = await res.json();
        if (!script) throw new Error('No audio returned');
        return { script };
      }
      return { audio: await res.arrayBuffer() };
    });
    guideCache.set(key, pending);
    pending.catch(() => guideCache.delete(key));
  }
  return pending;
};

// Wait this long after a place is opened before generating its audio in the
// background, so quickly skimmed places don't trigger generation.
const PREFETCH_DELAY_MS = 1500;

export function AudioGuide({ locationId, text, langCode }: AudioGuideProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => {
      loadGuideAudio(locationId, langCode).catch(() => {});
    }, PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [locationId, langCode, text]);

  useEffect(() => {
    // When text or lang changes, reset playing state
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsLoading(false);
    
    return () => {
      window.speechSynthesis.cancel();
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
    };
  }, [locationId, text, langCode]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!text) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      return;
    }

    if (isLoading) return;
    
    setIsLoading(true);

    // Initialize AudioContext synchronously to satisfy iOS Safari gesture requirements
    if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
            // Resume immediately within the synchronous click handler
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
            }
        }
    }

    try {
      const result = await loadGuideAudio(locationId, langCode);

      if ('script' in result) {
        // Server could narrate the script but not voice it
        useBrowserSpeech(result.script);
        return;
      }

      const audioCtx = audioCtxRef.current;
      if (!audioCtx) throw new Error('AudioContext not supported');
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // decodeAudioData detaches its input, so keep the cached copy intact
      const buffer = await audioCtx.decodeAudioData(result.audio.slice(0));
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();

      sourceRef.current = source;
      setIsPlaying(true);
      setIsLoading(false);

      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };
    } catch (error: any) {
      console.warn('Audio generation failed:', error);
      setIsLoading(false);
      
      // Full fallback to basic browser TTS with original text if anything else fails
      useBrowserSpeech(text);
    }
  };

  const useBrowserSpeech = (speechText: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = langCode === 'ar' ? 'ar-EG' : 'en-US';
    
    const voices = window.speechSynthesis.getVoices();
    const targetLangPrefix = langCode === 'ar' ? 'ar' : 'en';
    const voice = voices.find(v => v.lang.toLowerCase().startsWith(targetLangPrefix));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (e) => {
       console.warn('SpeechSynthesis error:', e);
       // Some browsers fire 'interrupted', but the speech still plays or gets caught
       if (e.error !== 'interrupted') {
           setIsPlaying(false);
       }
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsLoading(false);
  };

  return (
    <button
      onClick={togglePlay}
      disabled={isLoading && !isPlaying}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-sm ${
        isPlaying 
          ? 'bg-nile text-white shadow-md shadow-nile/30 border border-nile animate-[pulse_3s_ease-in-out_infinite]' 
          : isLoading
            ? 'bg-stone-100 text-stone-500 border border-stone-200 cursor-wait'
            : 'bg-white text-nile hover:bg-stone-50 border border-nile/20 hover:border-nile/50'
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
          {isArabic ? 'جاري التحضير...' : 'Loading Immersive Guide'}
        </>
      ) : isPlaying ? (
        <>
          <div className="flex items-center space-x-1 w-4">
            <div className="w-1 bg-white h-2 animate-[bounce_1s_infinite]"></div>
            <div className="w-1 bg-white h-4 animate-[bounce_1s_infinite_0.2s]"></div>
            <div className="w-1 bg-white h-3 animate-[bounce_1s_infinite_0.4s]"></div>
          </div>
          {isArabic ? 'إيقاف' : 'Stop'}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          {isArabic ? 'دليل صوتي تفاعلي' : 'Immersive Audio'}
        </>
      )}
    </button>
  );
}

