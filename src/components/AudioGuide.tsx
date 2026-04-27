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
  const { isArabic } = useLanguage();
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // When text or lang changes, reset playing state
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    }
    setIsPlaying(false);
    setIsLoading(false);
    
    return () => {
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

    try {
      // 1. Generate an immersive script based on the raw location text
      const scriptPrompt = `You are an immersive audio guide narrator for the historical city of Cairo. Make this historical fact sound like a captivating, slightly dramatic story for a tourist standing right there. Do NOT include any formatting, markdown, or sound effect markers. Keep it under 2 short paragraphs. Speak directly to the listener as if you are standing next to them. The response MUST be ONLY the spoken text, in ${langCode === 'ar' ? 'Arabic' : 'English'}. Here is the information:\n${text}`;

      const scriptResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: scriptPrompt,
      });
      
      const immersiveScript = scriptResponse.text;

      if (!immersiveScript) {
        throw new Error('Failed to generate script');
      }

      // 2. Generate high-quality TTS audio
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
        const audioCtx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
        audioCtxRef.current = audioCtx;
        
        // Ensure browser allows audio context
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
        throw new Error('No audio returned');
      }
    } catch (error) {
      console.error('Audio generation failed:', error);
      setIsLoading(false);
      
      // Fallback to basic browser TTS if Gemini fails
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode === 'ar' ? 'ar-EG' : 'en-US';
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
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

