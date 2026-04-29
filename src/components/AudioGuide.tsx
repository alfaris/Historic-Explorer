import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { GoogleGenAI, Modality } from "@google/genai";

interface AudioGuideProps {
  text: string;
  langCode: 'en' | 'ar';
}

// Ensure the API key is passed correctly via Vite's process.env define
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function AudioGuide({ text, langCode }: AudioGuideProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
    };
  }, [text, langCode]);

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
      // 1. Generate an immersive script based on the raw location text
      const scriptPrompt = `You are an immersive audio guide narrator for the historical city of Cairo. Make this historical fact sound like a captivating, slightly dramatic story for a tourist standing right there. Do NOT include any formatting, markdown, or sound effect markers. Keep it under 2 short paragraphs. Speak directly to the listener as if you are standing next to them. The response MUST be ONLY the spoken text, in ${langCode === 'ar' ? 'Arabic' : 'English'}. Here is the information:\n${text}`;

      const scriptResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: scriptPrompt,
      });
      
      const immersiveScript = scriptResponse.text;

      if (!immersiveScript) {
        throw new Error('Failed to generate script');
      }

      // 2. Generate high-quality TTS audio
      try {
        const ttsResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: immersiveScript }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: langCode === 'ar' ? 'Zephyr' : 'Kore' },
                },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          // Decode PCM and play
          const binaryString = window.atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          
          const int16Array = new Int16Array(bytes.buffer);
          const audioCtx = audioCtxRef.current;
          
          if (audioCtx) {
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
              }

              const buffer = audioCtx.createBuffer(1, int16Array.length, 24000);
              const channelData = buffer.getChannelData(0);
              for (let i = 0; i < int16Array.length; i++) {
                  channelData[i] = int16Array[i] / 32768.0;
              }
              
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
          } else {
             throw new Error('AudioContext not supported');
          }
        } else {
          throw new Error('No audio returned');
        }
      } catch (ttsError: any) {
        // If TTS model specifically fails with permission, we fallback to browser speech with the immersive script
        if (ttsError?.message?.includes('PERMISSION_DENIED') || ttsError?.message?.includes('403')) {
          console.warn('Gemini TTS denied permission, falling back to browser speech with generated script.');
          useBrowserSpeech(immersiveScript);
        } else {
          throw ttsError;
        }
      }
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

