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
        throw new Error('Gemini API Key is missing.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = isArabic 
        ? `ما هي أحدث التفاصيل والمراجعات والمعلومات حول ${locationNameAr} في القاهرة، مصر؟`
        : `What are the latest details, reviews, and information about ${locationNameEn} in Cairo, Egypt?`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      if (response.text) {
        setInfo(response.text);
      } else {
        setError(isArabic ? 'لم يتم العثور على معلومات.' : 'No information found.');
      }

      // Extract Maps Grounding Links
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const extractedLinks: { uri: string; title: string }[] = [];
        chunks.forEach((chunk: any) => {
          if (chunk.maps?.uri) {
            extractedLinks.push({
              uri: chunk.maps.uri,
              title: chunk.maps.title || (isArabic ? 'رابط خريطة جوجل' : 'Google Maps Link')
            });
          }
          if (chunk.maps?.placeAnswerSources?.reviewSnippets) {
             chunk.maps.placeAnswerSources.reviewSnippets.forEach((snippet: any) => {
               if (snippet.uri) {
                 extractedLinks.push({
                   uri: snippet.uri,
                   title: isArabic ? 'مراجعة' : 'Review'
                 });
               }
             });
          }
        });
        
        // Deduplicate links
        const uniqueLinks = Array.from(new globalThis.Map(extractedLinks.map(item => [item.uri, item])).values());
        setLinks(uniqueLinks);
      }

    } catch (err: any) {
      console.error('Error fetching live info:', err);
      setError(isArabic ? 'حدث خطأ أثناء جلب المعلومات.' : 'An error occurred while fetching information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-stone-100">
      <div className="flex items-center justify-between mb-4">
        <h4 className={`text-xs font-semibold text-stone-400 uppercase tracking-[0.2em] font-sans flex items-center gap-2`}>
          <Sparkles className="w-4 h-4 text-emerald-500" />
          {isArabic ? 'معلومات حية من الذكاء الاصطناعي' : 'Live AI Insights'}
        </h4>
        {!info && !loading && (
          <button
            onClick={fetchLiveInfo}
            className="text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
          >
            {isArabic ? 'جلب أحدث المعلومات' : 'Fetch Latest Info'}
          </button>
        )}
      </div>

      {loading && (
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-4 bg-stone-100 rounded w-3/4"></div>
          <div className="h-4 bg-stone-100 rounded w-full"></div>
          <div className="h-4 bg-stone-100 rounded w-5/6"></div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {info && (
        <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200">
          <div className="prose prose-stone prose-sm max-w-none mb-4">
            <Markdown>{info}</Markdown>
          </div>
          
          {links.length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-200 flex flex-wrap gap-2">
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-stone-200 text-stone-700 px-3 py-1.5 rounded-full hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-sm"
                >
                  <Map className="w-3 h-3 text-emerald-600" />
                  {link.title}
                  <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
