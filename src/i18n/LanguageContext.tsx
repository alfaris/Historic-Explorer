import React, { createContext, useState, useContext, useEffect } from 'react';

type Language = 'en' | 'ar';

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
    'monument': 'آثار ومباني تاريخية',
    'coffee': 'مقاهي',
    'restaurant': 'مطاعم وغذاء',
    'workshop': 'ورش ومنتجات يدوية',
    'stationary': 'خردوات ومكتبات',
    'meeting': 'نقاط التجمع',
    'nearby': 'أماكن قريبة',
    'directions': 'احصل على الاتجاهات',
    'routes': 'المسارات',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Detect user language
    const browserLang = navigator.language.startsWith('ar') ? 'ar' : 'en';
    setLanguage(browserLang);
  }, []);

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
