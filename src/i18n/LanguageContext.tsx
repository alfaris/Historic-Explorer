import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { initialLang, LANGUAGES, loadDictionary, setCurrentLang, type Lang } from './lang';

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
    'search': 'Search places…',
    'map': 'Map View',
    'list': 'List View',
    'near': 'Near Me',
    'monument': 'Monuments & Historic',
    'coffee': 'Coffee Shops',
    'restaurant': 'Restaurants & Food',
    'workshop': 'Workshops & Handicrafts',
    'stationary': 'Stationery & Toys',
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
  es: {
    'app.title': 'Explorador de El Cairo histórico',
    'app.subtitle': 'Descubre los monumentos y la vida de las calles históricas',
    'explore': 'Explorar',
    'categories': 'Categorías',
    'all': 'Todos los lugares',
    'search': 'Buscar un lugar…',
    'map': 'Mapa',
    'list': 'Lista',
    'near': 'Cerca de mí',
    'monument': 'Monumentos y patrimonio',
    'coffee': 'Cafés',
    'restaurant': 'Restaurantes y comida',
    'workshop': 'Talleres y artesanía',
    'stationary': 'Papelerías y juguetes',
    'meeting': 'Puntos de encuentro',
    'nearby': 'Lugares cercanos',
    'directions': 'Cómo llegar',
    'routes': 'Rutas',
  },
} satisfies Record<Lang, Record<string, string>>;

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/** A saved choice, else the link's or the browser's language. main.tsx loads its dictionary before the first paint. */
export function startingLang(): Lang {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // No storage (private mode): use the browser's language.
  }
  return initialLang(saved, navigator.language || '', new URLSearchParams(window.location.search).get('lang'));
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // A saved choice, else the browser's language (Arabic, French or English).
  const [language, setLanguageState] = useState<Language>(startingLang);
  const requested = useRef<Language | null>(null);
  const setLanguage = (lang: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not remembered; still switches for this visit.
    }
    // Its interface text first (downloaded the first time), so the switch is in one go.
    // Only the latest choice applies: a slower download for an earlier one is ignored.
    requested.current = lang;
    loadDictionary(lang).then(() => {
      if (requested.current === lang) setLanguageState(lang);
    });
  };
  // L(), nameOf() and friends read this; set before the tree renders.
  setCurrentLang(language);

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const dir = LANGUAGES[language].dir;

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
