import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { locations, categories, Category, Location, routes } from '../data/locations';
import { Search, MapPin, Coffee, Utensils, Hammer, BookOpen, Users, Landmark, Globe, Navigation, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const iconMap: Record<string, React.ElementType> = {
  Landmark,
  Coffee,
  Utensils,
  Hammer,
  BookOpen,
  Users
};

const getNearbyLocations = (loc: Location) => {
  const complementary: Record<Category, Category[]> = {
    monument: ['coffee', 'restaurant', 'workshop'],
    coffee: ['monument', 'stationary', 'meeting'],
    restaurant: ['monument', 'meeting'],
    workshop: ['coffee', 'monument'],
    stationary: ['coffee', 'monument'],
    meeting: ['restaurant', 'coffee', 'monument']
  };
  
  const targetCategories = complementary[loc.category] || ['monument'];
  
  return locations
    .filter(l => l.id !== loc.id && l.routeId === loc.routeId && targetCategories.includes(l.category))
    .sort((a, b) => Math.abs(a.id - loc.id) - Math.abs(b.id - loc.id))
    .slice(0, 3);
};

export const MainContent: React.FC = () => {
  const { t, language, setLanguage, dir } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>(routes[0].id);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesRoute = loc.routeId === selectedRoute;
      const matchesSearch = 
        loc.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.nameAr.includes(searchQuery);
      const matchesCategory = selectedCategory === 'all' || loc.category === selectedCategory;
      return matchesRoute && matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, selectedRoute]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const isArabic = language === 'ar';
  const fontClass = isArabic ? 'font-arabic' : 'font-sans';
  const headingFontClass = isArabic ? 'font-arabic font-bold' : 'font-serif';
  const currentRouteData = routes.find(r => r.id === selectedRoute) || routes[0];

  return (
    <div className={`min-h-screen pb-20 ${fontClass}`}>
      {/* Header */}
      <header className="bg-[#f8f7f4]/80 backdrop-blur-md border-b border-stone-200/50 sticky top-0 z-30 transition-all">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className={`text-2xl text-stone-900 tracking-tight ${headingFontClass}`}>
              {t('app.title')}
            </h1>
            <p className="text-xs text-stone-500 mt-1 uppercase tracking-widest">{t('app.subtitle')}</p>
          </div>
          <button 
            onClick={toggleLanguage}
            className="w-10 h-10 rounded-full border border-stone-200 hover:bg-stone-100 transition-colors flex items-center justify-center bg-white shadow-sm"
            aria-label="Toggle Language"
          >
            <span className="text-sm font-semibold text-stone-700">{language === 'en' ? 'ع' : 'EN'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Route Selector */}
        <div className="mb-8">
          <h3 className={`text-xs font-semibold text-stone-400 mb-4 uppercase tracking-[0.2em] ${fontClass}`}>
            {t('routes')}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {routes.map(route => (
              <button
                key={route.id}
                onClick={() => {
                  setSelectedRoute(route.id);
                  setSelectedLocation(null);
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-full text-sm transition-all duration-300 ${
                  selectedRoute === route.id 
                    ? 'bg-stone-900 text-white shadow-md transform scale-105' 
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                <Map className={`w-4 h-4 ${selectedRoute === route.id ? 'text-stone-300' : 'text-stone-400'}`} />
                <span className={selectedRoute === route.id ? 'font-medium' : ''}>
                  {isArabic ? route.nameAr : route.nameEn}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative rounded-[2rem] overflow-hidden mb-10 h-72 shadow-lg group">
          <img 
            src={currentRouteData.image} 
            alt={isArabic ? currentRouteData.nameAr : currentRouteData.nameEn} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent opacity-90"></div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <motion.h2 
              key={selectedRoute}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-4xl text-white mb-2 ${headingFontClass}`}
            >
              {isArabic ? currentRouteData.nameAr : currentRouteData.nameEn}
            </motion.h2>
            <motion.p 
              key={`${selectedRoute}-desc`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-stone-300 text-sm md:text-base max-w-lg leading-relaxed"
            >
              {isArabic ? currentRouteData.descriptionAr : currentRouteData.descriptionEn}
            </motion.p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <div className={`absolute inset-y-0 ${isArabic ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none`}>
            <Search className="w-5 h-5 text-stone-400" />
          </div>
          <input
            type="text"
            className={`block w-full rounded-full border-0 py-4 ${isArabic ? 'pr-12 pl-6' : 'pl-12 pr-6'} text-stone-900 shadow-sm ring-1 ring-inset ring-stone-200 placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-stone-800 sm:text-sm sm:leading-6 bg-white transition-shadow hover:shadow-md`}
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="mb-10 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-5 py-2.5 rounded-full text-sm transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-stone-800 text-white font-medium'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {t('all')}
            </button>
            {categories.map((cat) => {
              const Icon = iconMap[cat.icon];
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as Category)}
                  className={`flex items-center px-5 py-2.5 rounded-full text-sm transition-all border ${
                    isSelected
                      ? `${cat.color} text-white border-transparent font-medium shadow-sm`
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isArabic ? 'ml-2' : 'mr-2'} ${isSelected ? 'opacity-100' : 'opacity-70'}`} />
                  {isArabic ? cat.nameAr : cat.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline / List */}
        <div className="relative">
          {/* Vertical Line */}
          <div className={`absolute top-4 bottom-0 w-px border-l-2 border-dashed border-stone-300 ${isArabic ? 'right-6' : 'left-6'} -z-10`}></div>

          <div className="space-y-8">
            <AnimatePresence>
              {filteredLocations.map((loc, index) => {
                const category = categories.find(c => c.id === loc.category);
                const Icon = category ? iconMap[category.icon] : MapPin;
                const isSelected = selectedLocation === loc.id;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    key={loc.id}
                    className="relative flex items-start group"
                  >
                    {/* Timeline Node */}
                    <div className={`absolute ${isArabic ? 'right-0' : 'left-0'} flex items-center justify-center w-12 h-12 mt-2`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm z-10 ${category?.color || 'bg-stone-500'} text-white ring-4 ring-[#f8f7f4] transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Content Card */}
                    <div className={`flex-1 ${isArabic ? 'mr-16' : 'ml-16'}`}>
                      <div 
                        onClick={() => setSelectedLocation(isSelected ? null : loc.id)}
                        className={`bg-white rounded-[1.5rem] p-5 shadow-sm border border-stone-100 cursor-pointer transition-all duration-300 ${isSelected ? 'ring-2 ring-stone-400 shadow-md transform scale-[1.01]' : 'hover:shadow-md hover:border-stone-200'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className={`text-xl text-stone-900 ${headingFontClass}`}>
                              {isArabic ? loc.nameAr : loc.nameEn}
                            </h3>
                            <p className="text-xs font-medium text-stone-400 mt-1.5 uppercase tracking-widest">
                              {isArabic ? category?.nameAr : category?.nameEn}
                            </p>
                          </div>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400 text-xs font-mono">
                            {loc.id}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-4 mt-4 border-t border-stone-100">
                                <p className="text-sm text-stone-600 leading-relaxed">
                                  {isArabic 
                                    ? (loc.descriptionAr || 'لا يوجد وصف متاح حالياً لهذا الموقع.')
                                    : (loc.descriptionEn || 'No description available for this location at the moment.')}
                                </p>
                                
                                {/* Nearby Suggestions */}
                                {(() => {
                                  const nearby = getNearbyLocations(loc);
                                  if (nearby.length === 0) return null;
                                  
                                  return (
                                    <div className="mt-8 pt-6 border-t border-stone-100">
                                      <h4 className={`text-xs font-semibold text-stone-400 mb-4 uppercase tracking-[0.2em] ${fontClass}`}>
                                        {t('nearby')}
                                      </h4>
                                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                                        {nearby.map(n => {
                                          const nCat = categories.find(c => c.id === n.category);
                                          const NIcon = nCat ? iconMap[nCat.icon] : MapPin;
                                          return (
                                            <div 
                                              key={n.id} 
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedLocation(n.id);
                                              }}
                                              className="flex-shrink-0 w-56 p-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col gap-3 group"
                                            >
                                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${nCat?.color || 'bg-stone-500'} shadow-sm transition-transform group-hover:scale-110`}>
                                                <NIcon className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <p className={`text-base font-medium text-stone-900 line-clamp-1 ${headingFontClass}`}>
                                                  {isArabic ? n.nameAr : n.nameEn}
                                                </p>
                                                <p className="text-xs text-stone-400 mt-1 uppercase tracking-wider">
                                                  {isArabic ? nCat?.nameAr : nCat?.nameEn}
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const query = encodeURIComponent(`${loc.nameEn}, Cairo, Egypt`);
                                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
                                  }}
                                  className="mt-8 w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                  <Navigation className={`w-4 h-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
                                  {t('directions')}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {filteredLocations.length === 0 && (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 mx-auto bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-stone-400" />
                </div>
                <h3 className={`text-lg font-medium text-stone-900 mb-2 ${headingFontClass}`}>
                  {isArabic ? 'لم يتم العثور على نتائج' : 'No results found'}
                </h3>
                <p className="text-stone-500 text-sm">
                  {isArabic ? 'حاول البحث بكلمات مختلفة أو تغيير الفئة المحددة.' : 'Try adjusting your search or category filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
