import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { Sparkles, Map, ExternalLink } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LiveLocationInfoProps {
  locationNameEn: string;
  locationNameAr: string;
}

export const LiveLocationInfo: React.FC<LiveLocationInfoProps> = ({ locationNameEn, locationNameAr }) => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [links, setLinks] = useState<{ uri: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveInfo = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setLinks([]);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(isArabic ? 'مفتاح API الخاص بـ Gemini مفقود.' : 'Gemini API Key is missing.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = isArabic 
        ? `أعطني معلومات سياحية حية ومراجعات وتفاصيل تاريخية محدثة عن "${locationNameAr}" في القاهرة، مصر. استخدم بحث جوجل للحصول على أحدث المصادر.`
        : `Provide live tourist information, reviews, and updated historical details about "${locationNameEn}" in Cairo, Egypt. Use Google Search to find the latest sources.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      if (response.text) {
        setInfo(response.text);
      } else {
        setError(isArabic ? 'لم يتم العثور على معلومات دقيقة حالياً.' : 'No precise information found at the moment.');
      }

      // Extract Grounding Links (Search and Maps)
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const extractedLinks: { uri: string; title: string }[] = [];

      // Handle Search Metadata
      if (groundingMetadata?.searchEntryPoint) {
        // Search entry point available
      }

      // Handle Grounding Chunks (General)
      const chunks = groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri) {
            extractedLinks.push({
              uri: chunk.web.uri,
              title: chunk.web.title || (isArabic ? 'مصدر خارجي' : 'Web Source')
            });
          }
          if (chunk.maps?.uri) {
            extractedLinks.push({
              uri: chunk.maps.uri,
              title: chunk.maps.title || (isArabic ? 'خرائط جوجل' : 'Google Maps')
            });
          }
        });
      }

      // Deduplicate links
      const uniqueLinks = Array.from(new globalThis.Map(extractedLinks.map(item => [item.uri, item])).values());
      setLinks(uniqueLinks);

    } catch (err: any) {
      console.error('Audit: Live Info Failure:', err);
      // Surface actual error for debugging
      setError(
        isArabic 
          ? `عذراً، فشل الاتصال بخدمة الذكاء الاصطناعي: ${err.message || String(err)}`
          : `Connection to AI service failed: ${err.message || String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="mt-8 pt-6 border-t border-sand/30"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-6">
        <h4 className={`text-[10px] font-bold text-nile uppercase tracking-[0.3em] flex items-center gap-2`}>
          <Sparkles className="w-4 h-4 text-gold" />
          {isArabic ? 'بصيرة حية من الذكاء الاصطناعي' : 'Eclectic Live Insights'}
        </h4>
        {!info && !loading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchLiveInfo();
            }}
            className="text-[10px] font-bold bg-nile text-white px-5 py-2 rounded-xl hover:bg-nile-light transition-all duration-300 uppercase tracking-wider shadow-lg shadow-nile/10"
          >
            {isArabic ? 'فتح البصيرة' : 'Unlock Insights'}
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="animate-pulse flex flex-col gap-3">
            <div className="h-2 bg-sand/60 rounded-full w-3/4"></div>
            <div className="h-2 bg-sand/60 rounded-full w-full"></div>
            <div className="h-2 bg-sand/60 rounded-full w-5/6"></div>
          </div>
          <p className="text-[10px] text-stone-400 italic text-center animate-pulse">
            {isArabic ? 'جارٍ التشاور مع المصادر التاريخية...' : 'Consulting historical sources and live maps...'}
          </p>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-800 bg-red-50/50 p-4 rounded-2xl border border-red-100/50 backdrop-blur-sm">
          {error}
        </div>
      )}

      {info && (
        <div className="bg-chalk/50 rounded-[2rem] p-8 border border-sand/30 shadow-inner">
          <div className="prose prose-stone prose-sm max-w-none text-stone-600 font-serif leading-relaxed italic">
            <Markdown>{info}</Markdown>
          </div>
          
          {links.length > 0 && (
            <div className="mt-8 pt-6 border-t border-sand/20 flex flex-wrap gap-3">
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] font-bold bg-white border border-sand text-stone-500 hover:text-nile px-5 py-2.5 rounded-xl transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1 group"
                >
                  <Map className="w-3.5 h-3.5 text-stone-300 group-hover:text-gold transition-colors" />
                  <span className="uppercase tracking-widest">{link.title}</span>
                  <ExternalLink className="w-3 h-3 opacity-30" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
