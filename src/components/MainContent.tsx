import React, { useState, useMemo, useEffect, lazy } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { categories, Category } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { RoutePlaceholder } from './RoutePlaceholder';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { PlacePhoto } from './PlacePhoto';
import { PhotoCredits } from './PhotoCredits';
import { RouteProgress, VisitedBadge, VisitedToggle } from './Visited';
import { NearMeOverlay, NearMeView, useNearMe } from './NearMe';
import { ReportProblem } from './ReportProblem';
import { photoForPlace, photoForRoute } from '../data/photo-resolve';
import { Search, MapPin, Globe, Navigation, Map, List, ChevronRight, Cake, Coffee, Utensils, Hammer, BookOpen, Users, Landmark, ArrowUp, Share2, Clock, Route as RouteIcon, Star, LocateFixed, Footprints } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LiveLocationInfo } from './LiveLocationInfo';
import { AudioGuide } from './AudioGuide';
import { Logo } from './Logo';
import { RouteDownload } from './RouteDownload';
import { NextStop, StopNumber } from './WalkInfo';
import { walkPlan } from '../lib/walk';
import { track } from '../lib/track';
import { matchScore, searchPlaces } from '../lib/search';
import { OtherRouteResults } from './OtherRouteResults';
import { ShareRoute } from './ShareRoute';
import { routeFromSearch } from '../lib/share';
import { askForCompass } from '../lib/useWalkSensors';
import { LazyBoundary } from './LazyBoundary';

// The map (Leaflet, marker clustering and their CSS) is the largest part of the
// app, so it's loaded only when needed: in the background once the page is idle,
// or straight away if the map is opened first.
const loadMapView = () => import('./MapView');
const MapView = lazy(() => loadMapView().then(m => ({ default: m.MapView })));
// Loaded when a walk starts (the service worker precaches it, so it works offline).
const WalkMode = lazy(() => import('./WalkMode').then(m => ({ default: m.WalkMode })));

const MapFallback = () => (
  <div className="w-full h-full bg-chalk animate-pulse flex items-center justify-center">
    <Map className="w-10 h-10 text-stone-300" />
  </div>
);

const iconMap: Record<string, React.ElementType> = {
  Landmark,
  Coffee,
  Utensils,
  Hammer,
  BookOpen,
  Users
};

export const MainContent: React.FC = () => {
  // Live routes and places (admin edits), falling back to the bundled copy.
  const { places: locations, routes } = useContent();
  const { t, language, setLanguage, dir } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  // Start on the route of a shared place (?loc=) or route (?route=), so the
  // first screen, and the route-open count, aren't briefly the first route.
  const [selectedRoute, setSelectedRoute] = useState<string>(() => {
    const id = Number(new URLSearchParams(window.location.search).get('loc'));
    return (
      locations.find(l => l.id === id)?.routeId ??
      routeFromSearch(window.location.search, routes.map(r => r.id)) ??
      routes[0].id
    );
  });
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'near'>('list');

  // Fetch the map code in the background so switching to the map is instant.
  useEffect(() => {
    const preload = () => { loadMapView().catch(() => {}); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(preload, 3000);
    return () => clearTimeout(timer);
  }, []);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // Check URL for shared location. Re-checked when the live content
    // arrives, so links to places added in the admin dashboard work too.
    const params = new URLSearchParams(window.location.search);
    const locIdParam = params.get('loc');
    if (locIdParam) {
      const locId = parseInt(locIdParam, 10);
      const loc = locations.find(l => l.id === locId);
      if (loc) {
        setSelectedRoute(loc.routeId);
        setSelectedLocation(loc.id);
        
        // Remove param without reloading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        setTimeout(() => {
          const el = document.getElementById(`location-${loc.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }, [locations]);

  // A shared route link (?route=). Re-checked when the live content arrives,
  // so links to routes added in the admin work too. The parameter is then
  // removed, like ?loc=, so it doesn't stick to later navigation.
  useEffect(() => {
    const id = routeFromSearch(window.location.search, routes.map(r => r.id));
    if (!id) return;
    setSelectedRoute(id);
    setSelectedLocation(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('route');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [routes]);

  // If the selected route was deleted in the admin dashboard, fall back to the first one.
  useEffect(() => {
    if (!routes.some(r => r.id === selectedRoute)) setSelectedRoute(routes[0].id);
  }, [routes, selectedRoute]);

  // When the live content arrives, keep a selected place (e.g. from a shared
  // link) visible even if the admin moved it to another route.
  useEffect(() => {
    if (selectedLocation === null) return;
    const place = locations.find(l => l.id === selectedLocation);
    if (place && place.routeId !== selectedRoute) setSelectedRoute(place.routeId);
    // Only on content changes: picking another route clears the selection anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations]);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesRoute = loc.routeId === selectedRoute;
      // Forgiving match (Arabic letter variants, vowel marks, punctuation); see lib/search.
      const matchesSearch = !searchQuery.trim() || matchScore(loc, searchQuery) > 0;
      const matchesCategory = selectedCategory === 'all' || loc.category === selectedCategory;
      return matchesRoute && matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, selectedRoute, locations]);

  // While searching, matches on the other routes too, best first.
  const otherRouteMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const others = locations.filter(l => l.routeId !== selectedRoute && (selectedCategory === 'all' || l.category === selectedCategory));
    return searchPlaces(others, searchQuery);
  }, [searchQuery, selectedCategory, selectedRoute, locations]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const isArabic = language === 'ar';
  const fontClass = isArabic ? 'font-arabic' : 'font-sans';
  const headingFontClass = isArabic ? 'font-arabic font-bold' : 'font-serif';
  const currentRouteData = routes.find(r => r.id === selectedRoute) || routes[0];
  // Memoized so "Near me" only resets its arrival state when the route changes.
  const routePlaces = useMemo(() => locations.filter(l => l.routeId === selectedRoute), [selectedRoute, locations]);
  // Anonymous count of which routes are opened (once per route per visit).
  // Choosing a route drops a shared link that never resolved (e.g. to a place
  // since deleted), so route opens are counted again from here on.
  const pendingSharedLink = () => {
    const params = new URLSearchParams(window.location.search);
    return params.has('loc') || params.has('route');
  };
  const clearSharedLink = () => {
    if (pendingSharedLink()) window.history.replaceState({}, '', window.location.pathname);
  };

  // A shared link to a place only in the live content resolves once that
  // arrives; until then (?loc= or ?route= still in the URL) the route shown
  // isn't the visitor's choice, so don't count it.
  useEffect(() => {
    if (pendingSharedLink()) return;
    if (routes.some(r => r.id === selectedRoute)) track({ t: 'route', id: selectedRoute });
  }, [selectedRoute, routes, locations]);
  // Stop numbers and the walk to the next stop, in the route's walking order.
  const plan = useMemo(() => walkPlan(locations, selectedRoute), [locations, selectedRoute]);

  // Near me keeps watching location across all three tabs until stopped.
  const nearMe = useNearMe(isArabic, locations);
  // "Start the walk": open the guided view, turning on location (and, on iOS,
  // asking for the compass) from the tap. Location turned on for the walk is
  // turned off again when it ends.
  const [walking, setWalking] = useState(false);
  // Bumped on every start, so the error card below shows again on a new try.
  // (Browsers remember a failed module download until the page reloads.)
  const [walkAttempt, setWalkAttempt] = useState(0);
  const walkStartedLocation = React.useRef(false);
  const startWalk = () => {
    askForCompass();
    walkStartedLocation.current = !nearMe.on;
    if (!nearMe.on) nearMe.start();
    setWalkAttempt(n => n + 1);
    setWalking(true);
  };
  const endWalk = () => {
    setWalking(false);
    if (walkStartedLocation.current) nearMe.stop();
    walkStartedLocation.current = false;
  };

  // Open a place from "Near me" (possibly on another route): show it expanded
  // in the list and scroll to it.
  const openPlace = (id: number) => {
    const place = locations.find(l => l.id === id);
    if (place) setSelectedRoute(place.routeId);
    setViewMode('list');
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLocation(id);
    setTimeout(() => {
      document.getElementById(`location-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // "Next stop" in map view: clear the search and category filters first, so
  // the next stop's marker is on the map and the map can move to it.
  const openStopOnMap = (id: number) => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedLocation(id);
  };

  // Selection is cleared by the route buttons themselves. Clearing it in an
  // effect on every route change also wiped selections made together with a
  // route change (shared ?loc= links, opening a place from Near me).

  return (
    <div className={`min-h-screen pb-20 ${fontClass}`}>
      {/* Header */}
      <header className="glass sticky top-0 z-[2000] px-6 py-8 transition-all">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo className="h-10 w-10 md:h-12 md:w-12 text-nile shrink-0" />
            <div className={`flex flex-col ${isArabic ? 'border-r-2 border-gold pr-4' : 'border-l-2 border-gold pl-4'}`}>
              <h1 className={`text-xl md:text-2xl text-ink font-bold ${headingFontClass}`}>
                {isArabic ? 'القاهرة' : 'CAIRO'}
              </h1>
              <span className={`text-[10px] text-stone-500 uppercase font-medium whitespace-nowrap mt-0.5 ${isArabic ? 'tracking-[0.2em]' : 'tracking-[0.3em]'}`}>
                {isArabic ? 'مستكشف التاريخ' : 'Historic Explorer'}
              </span>
            </div>
          </div>
          <button 
            onClick={toggleLanguage}
            className="group flex flex-col items-center gap-1"
            aria-label="Toggle Language"
          >
            <div className="w-12 h-12 rounded-full border border-sand hover:border-nile transition-all duration-500 flex items-center justify-center bg-white shadow-sm ring-0 group-hover:ring-4 group-hover:ring-nile/5">
              <Globe className="w-4 h-4 text-stone-400 group-hover:text-nile transition-colors" />
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{language === 'en' ? 'عربي' : 'English'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-28 md:pb-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 text-[10px] uppercase tracking-widest text-stone-400 font-bold overflow-x-auto whitespace-nowrap pb-2">
          <span className="hover:text-nile cursor-pointer transition-colors" onClick={() => setSelectedLocation(null)}>{t('app.title')}</span>
          <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
          <span className="text-nile">{isArabic ? currentRouteData.nameAr : currentRouteData.nameEn}</span>
          {selectedCategory !== 'all' && (
            <>
              <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
              <span className="text-gold-ink">{isArabic ? categories.find(c => c.id === selectedCategory)?.nameAr : categories.find(c => c.id === selectedCategory)?.nameEn}</span>
            </>
          )}
          {selectedLocation && (
            <>
              <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
              <span className="text-nile-light truncate max-w-[150px]">
                {isArabic ? locations.find(l => l.id === selectedLocation)?.nameAr : locations.find(l => l.id === selectedLocation)?.nameEn}
              </span>
            </>
          )}
        </div>

        {/* Route Selector */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-bold text-nile uppercase tracking-[0.25em]">
              {t('routes')}
            </h2>
            <div className="h-px flex-1 bg-sand/50"></div>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {routes.map((route, routeIndex) => (
              <div key={route.id} className="flex-none w-[220px] md:w-[260px] snap-start flex flex-col gap-3">
                <button
                  onClick={() => {
                    clearSharedLink();
                    setSelectedRoute(route.id);
                    setSelectedLocation(null);
                  }}
                  className={`group relative h-24 w-full rounded-2xl overflow-hidden transition-all duration-500 ${
                    selectedRoute === route.id 
                      ? 'ring-2 ring-nile ring-offset-4 ring-offset-chalk' 
                      : 'hover:shadow-xl hover:-translate-y-1'
                  }`}
                >
                  <PlacePhoto
                    photo={photoForRoute(route)}
                    alt={isArabic ? route.nameAr : route.nameEn}
                    sizes="(min-width: 768px) 260px, 220px"
                    priority={routeIndex < 2}
                    className="absolute inset-0 w-full h-full"
                    fallback={
                      <RoutePlaceholder 
                        routeId={route.id} 
                        name={isArabic ? route.nameAr : route.nameEn}
                        className="absolute inset-0 w-full h-full"
                      />
                    }
                  />
                  <div className={`absolute inset-0 bg-ink/20 transition-opacity duration-500 ${selectedRoute === route.id ? 'opacity-40' : 'opacity-20 group-hover:opacity-30'}`}></div>
                </button>
                <div className="text-center px-2">
                  <h3 className={`text-sm md:text-base text-ink ${headingFontClass}`}>
                    {isArabic ? route.nameAr : route.nameEn}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Route Meta */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <motion.div
            key={selectedRoute}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="flex flex-col items-center"
          >
            <h2 className={`text-4xl md:text-5xl text-ink mb-2 ${headingFontClass}`}>
              {isArabic ? currentRouteData.nameAr : currentRouteData.nameEn}
            </h2>
            
            <div className={`flex items-center gap-6 mb-6 text-[10px] font-bold uppercase tracking-widest text-nile`}>
              <div className="flex items-center gap-2">
                <RouteIcon className="w-3.5 h-3.5 text-gold" />
                <span>{currentRouteData.distance}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gold" />
                <span>{currentRouteData.duration}</span>
              </div>
            </div>

            <p className="text-stone-500 italic text-base md:text-lg leading-relaxed font-serif mb-8">
              "{isArabic ? currentRouteData.descriptionAr : currentRouteData.descriptionEn}"
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {(isArabic ? currentRouteData.highlightsAr : currentRouteData.highlightsEn).map((highlight, i) => (
                <span key={i} className="px-4 py-2 bg-chalk/80 text-stone-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-sand/30 flex items-center gap-2">
                  <Star className="w-3 h-3 text-gold fill-gold" />
                  {highlight}
                </span>
              ))}
            </div>

            <RouteProgress placeIds={routePlaces.map(l => l.id)} isArabic={isArabic} />

            <div className="mb-4 flex flex-wrap justify-center gap-3">
            {plan.size > 0 && (
              <button
                onClick={startWalk}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-nile text-white text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-nile-light transition-colors"
              >
                <Footprints className="w-4 h-4" />
                {isArabic ? 'ابدأ الجولة' : 'Start the walk'}
              </button>
            )}
            <ShareRoute route={currentRouteData} isArabic={isArabic} />
            </div>

            <RouteDownload route={currentRouteData} places={routePlaces} />
          </motion.div>
        </div>

        {/* View & Search Controls */}
        <div className="bg-white rounded-3xl p-4 md:p-6 shadow-xl shadow-stone-200/50 border border-sand/50 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className={`absolute ${isArabic ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300`} />
              <input
                type="text"
                className={`w-full bg-chalk/50 rounded-2xl py-4 ${isArabic ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-nile/10 transition-all`}
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* View Toggle (Desktop) */}
            <div className="hidden md:flex p-1 bg-chalk rounded-2xl w-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-nile shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                {t('list')}
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  viewMode === 'map' 
                    ? 'bg-white text-nile shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                {t('map')}
              </button>
              <button
                onClick={() => setViewMode('near')}
                className={`flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  viewMode === 'near' 
                    ? 'bg-white text-nile shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <LocateFixed className={`w-3.5 h-3.5 ${nearMe.on ? 'text-gold' : ''}`} />
                {t('near')}
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="mt-6 flex overflow-x-auto gap-2 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex-none snap-start px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                selectedCategory === 'all'
                  ? 'bg-nile text-white shadow-lg shadow-nile/20'
                  : 'bg-chalk text-stone-500 hover:bg-sand/50'
              }`}
            >
              {t('all')}
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const iconMap: Record<string, any> = { Landmark, Coffee, Utensils, Hammer, BookOpen, Users };
              const Icon = iconMap[cat.icon] || MapPin;
              
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as Category)}
                  className={`flex-none snap-start flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-nile text-white shadow-lg shadow-nile/20'
                      : 'bg-chalk text-stone-500 hover:bg-sand/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 opacity-70" />
                  {isArabic ? cat.nameAr : cat.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'near' ? (
          <NearMeView
            nearMe={nearMe}
            routePlaces={routePlaces}
            allPlaces={locations}
            routeName={isArabic ? currentRouteData.nameAr : currentRouteData.nameEn}
            isArabic={isArabic}
            onOpenPlace={openPlace}
          />
        ) : viewMode === 'map' ? (
          <div className="mb-8">
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-sand h-[600px] md:h-[75vh] min-h-[600px]">
              <LazyBoundary
                loading={<MapFallback />}
                failed={
                  <div className="w-full h-full bg-chalk flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <Map className="w-10 h-10 text-stone-300" />
                    <p className="text-sm text-stone-500 max-w-xs">
                      {isArabic
                        ? 'تعذّر تحميل الخريطة. تحقق من اتصالك بالإنترنت.'
                        : "The map couldn't load. Check your connection."}
                    </p>
                    <button
                      // Browsers remember a failed module download, so retrying
                      // needs a reload (as Vite recommends for failed chunks).
                      onClick={() => window.location.reload()}
                      className="text-[10px] font-bold bg-nile text-white px-5 py-2 rounded-xl hover:bg-nile-light transition-all duration-300 uppercase tracking-wider"
                    >
                      {isArabic ? 'حاول مرة أخرى' : 'Try again'}
                    </button>
                  </div>
                }
              >
                <MapView 
                  locations={filteredLocations} 
                  selectedLocation={selectedLocation} 
                  onSelectLocation={setSelectedLocation} 
                />
              </LazyBoundary>
            </div>
            
            <AnimatePresence>
              {selectedLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-6 md:mt-8"
                >
                  {(() => {
                    const loc = locations.find(l => l.id === selectedLocation);
                    if (!loc) return null;
                    const category = categories.find(c => c.id === loc.category);
                    
                    return (
                      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-sand/50">
                        <div className="grid md:grid-cols-2 gap-10">
                        <div className="md:col-span-1">
                          <PlacePhoto
                            photo={photoForPlace(loc)}
                            alt={isArabic ? loc.nameAr : loc.nameEn}
                            className="w-full h-80 rounded-3xl shadow-xl"
                            showCredit
                            fallback={
                              <HistoricPlaceholder 
                                category={loc.category} 
                                name={loc.nameEn}
                                className="w-full h-80 rounded-3xl shadow-xl"
                              />
                            }
                          />
                        </div>
                          <div>
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className={`text-4xl text-ink leading-tight ${headingFontClass}`}>
                                  {isArabic ? loc.nameAr : loc.nameEn}
                                </h3>
                                <p className="text-[10px] font-bold text-nile mt-3 uppercase tracking-[0.3em]">
                                  {isArabic ? category?.nameAr : category?.nameEn}
                                </p>
                                {plan.get(loc.id) && <div className="mt-2"><StopNumber info={plan.get(loc.id)!} isArabic={isArabic} /></div>}
                              </div>
                              <button 
                                onClick={() => setSelectedLocation(null)}
                                className="w-10 h-10 rounded-full bg-chalk flex items-center justify-center text-stone-400 hover:text-ink transition-colors"
                              >
                                <Search className="w-4 h-4 rotate-45" /> 
                              </button>
                            </div>
                            {plan.get(loc.id) && (
                              <div className="mb-6">
                                <NextStop info={plan.get(loc.id)!} isArabic={isArabic} onOpen={openStopOnMap} />
                              </div>
                            )}
                            
                            <div className="mb-8">
                              <p className="text-stone-600 text-lg leading-relaxed mb-4 font-serif italic">
                                {isArabic 
                                  ? (loc.descriptionAr || 'لا يوجد وصف متاح حالياً لهذا الموقع.')
                                  : (loc.descriptionEn || 'No description available for this location at the moment.')}
                              </p>
                              <AudioGuide 
                                locationId={loc.id}
                                text={isArabic ? (loc.descriptionAr || '') : (loc.descriptionEn || '')}
                                langCode={isArabic ? 'ar' : 'en'} 
                              />
                            </div>
                            
                            <LiveLocationInfo locationId={loc.id} />
                            
                            <div className="flex flex-col sm:flex-row gap-4 mt-10">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const query = encodeURIComponent(`${loc.nameEn}, Cairo, Egypt`);
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
                                }}
                                className="flex-1 py-5 bg-ink hover:bg-nile text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center shadow-xl hover:shadow-2xl translate-z-0"
                              >
                                <Navigation className={`w-3.5 h-3.5 ${isArabic ? 'ml-3' : 'mr-3'}`} />
                                {t('directions')}
                              </button>
                              <VisitedToggle placeId={loc.id} isArabic={isArabic} className="py-5 rounded-2xl" />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = new URL(window.location.href);
                                  url.searchParams.set('loc', loc.id.toString());
                                  navigator.clipboard.writeText(url.toString());
                                  alert(isArabic ? 'تم نسخ الرابط' : 'Link copied to clipboard');
                                }}
                                className="flex justify-center items-center py-5 px-6 bg-chalk hover:bg-sand/30 text-ink rounded-2xl transition-all duration-300"
                                aria-label="Share Location"
                              >
                                <Share2 className="w-5 h-5" />
                              </button>
                            </div>
                            <div className="mt-4 text-center">
                              <ReportProblem place={loc} isArabic={isArabic} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
            {otherRouteMatches.length > 0 && (
              <div className="mt-6">
                <OtherRouteResults places={otherRouteMatches} routes={routes} isArabic={isArabic} onOpen={openPlace} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <AnimatePresence mode="popLayout">
              {filteredLocations.map((loc, index) => {
                const category = categories.find(c => c.id === loc.category);
                const isSelected = selectedLocation === loc.id;

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    key={loc.id}
                    id={`location-${loc.id}`}
                    className="group"
                  >
                    <div 
                      onClick={() => setSelectedLocation(isSelected ? null : loc.id)}
                      className={`bg-white rounded-[2rem] overflow-hidden shadow-xl border border-sand/30 cursor-pointer transition-all duration-700 ${isSelected ? 'ring-2 ring-nile ring-offset-8 shadow-2xl' : 'hover:shadow-2xl hover:-translate-y-2'}`}
                    >
                      <div className="flex flex-col md:flex-row h-full">
                        <div className="md:w-1/3 h-56 md:h-auto overflow-hidden">
                          <PlacePhoto
                            photo={photoForPlace(loc)}
                            alt={isArabic ? loc.nameAr : loc.nameEn}
                            sizes="(min-width: 768px) 33vw, 100vw"
                            className="w-full h-full min-h-56"
                            showCredit={isSelected}
                            fallback={
                              <HistoricPlaceholder 
                                category={loc.category} 
                                name={loc.nameEn}
                                className="w-full h-full"
                              />
                            }
                          />
                        </div>
                        <div className={`flex-1 p-8 md:p-10 flex flex-col justify-center ${!photoForPlace(loc) ? 'md:w-full' : ''}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                                <p className="text-[10px] font-bold text-gold-ink uppercase tracking-[0.3em]">
                                  {isArabic ? category?.nameAr : category?.nameEn}
                                </p>
                                <VisitedBadge placeId={loc.id} isArabic={isArabic} />
                              </div>
                              <h3 className={`text-3xl text-ink leading-tight ${headingFontClass}`}>
                                {isArabic ? loc.nameAr : loc.nameEn}
                              </h3>
                              {plan.get(loc.id) && <div className="mt-2"><StopNumber info={plan.get(loc.id)!} isArabic={isArabic} /></div>}
                            </div>
                            {plan.get(loc.id) && (
                              <div className="text-3xl font-serif text-sand/50 italic opacity-50" aria-hidden="true">
                                {String(plan.get(loc.id)!.number).padStart(2, '0')}
                              </div>
                            )}
                          </div>
                          {plan.get(loc.id) && (
                            <NextStop info={plan.get(loc.id)!} isArabic={isArabic} onOpen={openPlace} />
                          )}

                              <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="pt-8 mt-8 border-t border-chalk">
                                  <div className="mb-8">
                                    <p className="text-stone-600 text-lg leading-relaxed mb-4 font-serif italic">
                                      {isArabic 
                                        ? (loc.descriptionAr || 'لا يوجد وصف متاح حالياً لهذا الموقع.')
                                        : (loc.descriptionEn || 'No description available for this location at the moment.')}
                                    </p>
                                    <AudioGuide 
                                      locationId={loc.id}
                                      text={isArabic ? (loc.descriptionAr || '') : (loc.descriptionEn || '')}
                                      langCode={isArabic ? 'ar' : 'en'} 
                                    />
                                  </div>
                                  
                                  <LiveLocationInfo locationId={loc.id} />

                                  <div className="flex flex-col sm:flex-row gap-4 mt-8">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const query = encodeURIComponent(`${loc.nameEn}, Cairo, Egypt`);
                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
                                      }}
                                      className="flex-1 py-4 bg-ink hover:bg-nile text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center shadow-lg"
                                    >
                                      <Navigation className={`w-3.5 h-3.5 ${isArabic ? 'ml-3' : 'mr-3'}`} />
                                      {t('directions')}
                                    </button>
                                    <VisitedToggle placeId={loc.id} isArabic={isArabic} className="py-4" />
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const url = new URL(window.location.href);
                                        url.searchParams.set('loc', loc.id.toString());
                                        navigator.clipboard.writeText(url.toString());
                                        alert(isArabic ? 'تم نسخ الرابط' : 'Link copied to clipboard');
                                      }}
                                      className="flex justify-center items-center py-4 px-6 bg-chalk hover:bg-sand/30 text-ink rounded-xl transition-all duration-300"
                                      aria-label="Share Location"
                                    >
                                      <Share2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="mt-4 text-center">
                                    <ReportProblem place={loc} isArabic={isArabic} />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {filteredLocations.length === 0 && otherRouteMatches.length === 0 && (
              <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-sand">
                <Search className="w-12 h-12 text-stone-200 mx-auto mb-6" />
                <h3 className={`text-3xl text-stone-400 ${headingFontClass}`}>
                  {isArabic ? 'لم يتم العثور على نتائج' : 'No explorations found'}
                </h3>
              </div>
            )}
            {filteredLocations.length === 0 && otherRouteMatches.length > 0 && (
              <p className="text-center text-stone-500">
                {isArabic ? 'لا نتائج في هذا المسار، لكن وجدنا أماكن في مسارات أخرى:' : 'Nothing on this route, but there are matches on other routes:'}
              </p>
            )}
            <OtherRouteResults places={otherRouteMatches} routes={routes} isArabic={isArabic} onOpen={openPlace} />
          </div>
        )}

        <PhotoCredits isArabic={isArabic} />
      </main>

      {viewMode !== 'near' && !walking && (
        <NearMeOverlay nearMe={nearMe} isArabic={isArabic} onOpenPlace={openPlace} onShowTab={() => setViewMode('near')} />
      )}
      {walking && (
        <LazyBoundary
          key={walkAttempt}
          loading={null}
          failed={
            // The walk's code couldn't download (e.g. offline before it was cached):
            // say so, and give a way out that also turns location back off.
            <div className="fixed z-[7000] inset-x-4 bottom-28 md:bottom-8 md:inset-x-auto md:end-8 md:w-96 bg-white rounded-3xl shadow-2xl border border-sand/50 p-5" role="alert" dir={isArabic ? 'rtl' : 'ltr'}>
              <p className="text-sm text-ink mb-3">
                {isArabic ? 'تعذّر فتح الجولة. تحقق من اتصالك بالإنترنت، ثم أعد تحميل الصفحة.' : "The walk couldn't open. Check your connection, then reload the page."}
              </p>
              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest">
                  {isArabic ? 'إعادة التحميل' : 'Reload'}
                </button>
                <button onClick={endWalk} className="px-4 py-2 rounded-xl bg-chalk text-ink text-xs font-bold uppercase tracking-widest">
                  {isArabic ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          }
        >
          <WalkMode route={currentRouteData} places={locations} nearMe={nearMe} isArabic={isArabic} onClose={endWalk} />
        </LazyBoundary>
      )}

      {/* Floating Scroll Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            aria-label={isArabic ? 'العودة إلى الأعلى' : 'Back to top'}
            className={`fixed ${viewMode === 'list' && !showScrollTop ? 'bottom-24' : 'bottom-24'} md:bottom-8 ${isArabic ? 'left-8' : 'right-8'} w-14 h-14 rounded-full bg-nile text-white shadow-2xl flex items-center justify-center z-[3000] hover:bg-gold transition-colors duration-500`}
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Navbar */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] z-[4000] bg-white/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-200 p-1 flex">
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            viewMode === 'list' 
              ? 'bg-nile text-white shadow-md' 
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <List className="w-4 h-4" />
          {t('list')}
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            viewMode === 'map' 
              ? 'bg-nile text-white shadow-md' 
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Map className="w-4 h-4" />
          {t('map')}
        </button>
        <button
          onClick={() => setViewMode('near')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            viewMode === 'near' 
              ? 'bg-nile text-white shadow-md' 
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <LocateFixed className={`w-4 h-4 ${nearMe.on && viewMode !== 'near' ? 'text-gold animate-pulse' : ''}`} />
          {t('near')}
        </button>
      </div>
    </div>
  );
};
