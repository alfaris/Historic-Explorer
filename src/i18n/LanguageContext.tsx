import React, { createContext, useState, useContext, useEffect } from 'react';
import { initialLang, setCurrentLang, type Lang } from './lang';

type Language = Lang;
const STORAGE_KEY = 'cairo-walks:lang';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations = {
  en: {
    'app.title': 'Cairo Historic Explorer',
    'app.subtitle': 'Discover the monuments and life of historic streets',
    'explore': 'Explore',
    'categories': 'Categories',
    'all': 'All Places',
    'search': 'Search locations...',
    'map': 'Map View',
    'list': 'List View',
    'near': 'Near Me',
    'monument': 'Monuments & Historic',
    'coffee': 'Coffee Shops',
    'restaurant': 'Restaurants & Food',
    'workshop': 'Workshops & Handicrafts',
    'stationary': 'Stationary & Toys',
    'meeting': 'Meeting Points',
    'nearby': 'Nearby Places',
    'directions': 'Get Directions',
    'routes': 'Routes',
  },
  ar: {
    'app.title': 'مستكشف القاهرة التاريخية',
    'app.subtitle': 'اكتشف الآثار والحياة في الشوارع التاريخية',
    'explore': 'استكشف',
    'categories': 'الفئات',
    'all': 'كل الأماكن',
    'search': 'ابحث عن الأماكن...',
    'map': 'الخريطة',
    'list': 'القائمة',
    'near': 'بالقرب مني',
    'monument': 'آثار ومباني تاريخية',
    'coffee': 'مقاهي',
    'restaurant': 'مطاعم وغذاء',
    'workshop': 'ورش ومنتجات يدوية',
    'stationary': 'خردوات ومكتبات',
    'meeting': 'نقاط التجمع',
    'nearby': 'أماكن قريبة',
    'directions': 'احصل على الاتجاهات',
    'routes': 'المسارات',
  },
  fr: {
    'app.title': 'Explorateur du Caire historique',
    'app.subtitle': 'Découvrez les monuments et la vie des rues historiques',
    'explore': 'Explorer',
    'categories': 'Catégories',
    'all': 'Tous les lieux',
    'search': 'Rechercher un lieu…',
    'map': 'Carte',
    'list': 'Liste',
    'near': 'Autour de moi',
    'monument': 'Monuments et patrimoine',
    'coffee': 'Cafés',
    'restaurant': 'Restaurants et cuisine',
    'workshop': 'Ateliers et artisanat',
    'stationary': 'Papeteries et jouets',
    'meeting': 'Points de rendez-vous',
    'nearby': 'Lieux à proximité',
    'directions': 'Itinéraire',
    'routes': 'Parcours',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // A saved choice, else the browser's language (Arabic, French or English).
  const [language, setLanguageState] = useState<Language>(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // No storage (private mode): use the browser's language.
    }
    return initialLang(saved, navigator.language || '');
  });
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not remembered; still switches for this visit.
    }
  };
  // L(), nameOf() and friends read this; set before the tree renders.
  setCurrentLang(language);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
