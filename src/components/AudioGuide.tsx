import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface AudioGuideProps {
  text: string;
  langCode: 'en' | 'ar';
}

export function AudioGuide({ text, langCode }: AudioGuideProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { isArabic } = useLanguage();
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // When text or lang changes, reset everything
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text, langCode]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!text) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    } else {
      window.speechSynthesis.cancel(); // clear previous
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode === 'ar' ? 'ar-EG' : 'en-US';
      
      // Try to find a specific voice for the language to improve reliability
      const voices = window.speechSynthesis.getVoices();
      const targetLangPrefix = langCode === 'ar' ? 'ar' : 'en';
      const voice = voices.find(v => v.lang.toLowerCase().startsWith(targetLangPrefix));
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = 0.9;
      
      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      
      utterance.onerror = (e) => {
        console.error('SpeechSynthesis error:', e);
        setIsPlaying(false);
        setIsPaused(false);
      };
      
      // Store reference to prevent garbage collection in some browsers (like Chrome)
      utteranceRef.current = utterance;

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    }
  };

  return (
    <button
      onClick={togglePlay}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
        isPlaying 
          ? 'bg-nile text-white shadow-md shadow-nile/20' 
          : 'bg-stone-100 text-nile hover:bg-stone-200'
      }`}
    >
      {isPlaying ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current" />
          {isArabic ? 'إيقاف' : 'Stop'}
        </>
      ) : (
        <>
          <Volume2 className="w-3.5 h-3.5" />
          {isArabic ? 'استمع' : 'Listen'}
        </>
      )}
    </button>
  );
}
