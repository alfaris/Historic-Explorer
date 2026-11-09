import React, { useState, useMemo, useEffect, lazy } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { categories, Category } from '../data/locations';
import { useContent } from '../data/ContentContext';
import { RoutePlaceholder } from './RoutePlaceholder';
import { HistoricPlaceholder } from './HistoricPlaceholder';
import { PlacePhoto } from './PlacePhoto';
import { PhotoCredits } from './PhotoCredits';
import { RouteProgress, VisitedBadge, VisitedToggle } from './Visited';
import { WalkFinish } from './WalkFinish';
import { useVisited } from '../lib/visited';
import { justCompleted, walkSummary } from '../lib/walk-summary';
import { NearMeOverlay, NearMeView, useNearMe } from './NearMe';
import { ReportProblem } from './ReportProblem';
import { photoForPlace, photoForRoute, photoAltOf } from '../data/photo-resolve';
import { Search, MapPin, Navigation, Map, List, ChevronRight, Cake, Coffee, Utensils, Hammer, BookOpen, Users, Landmark, ArrowUp, Clock, Accessibility, X, Printer, Route as RouteIcon, Star, LocateFixed, Footprints } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LiveLocationInfo } from './LiveLocationInfo';
import { Logo } from './Logo';
import { RouteDownload } from './RouteDownload';
import { NextStop, StopNumber, stopOfLabel } from './WalkInfo';
import { walkPlan } from '../lib/walk';
import { track } from '../lib/track';
import { matchScore, searchPlaces } from '../lib/search';
import { formatDistance, formatDuration } from '../lib/route-format';
import { HoursBadge, useNow } from './PlaceHours';
import { anyFilter, NO_FILTERS, passesFilters, withoutHours, type PlaceFilters } from '../lib/place-filters';
import { EraFilter, ThroughTheAgesButton } from './PlaceEra';
import { WeatherAdvice } from './WeatherAdvice';
import { PlaceBadges, PlaceDetails } from './PlaceDetails';
import { breakCount } from '../lib/weather';
import { nextQuarter } from '../lib/visit-plan';
import { PrayerNotice } from './PrayerTimes';
import { SaveToggle, SavedButton, SharedListSheet } from './Saved';
import { addRecent } from '../lib/recent';
import { PassportButton, PassportSheet } from './Passport';
import { stampRoute } from '../lib/passport';
import { cairoDate } from '../lib/special-hours';
import { spotCount, spotted } from '../lib/spot-it';
import { DisplaySettings } from './DisplaySettings';
import { HelpButton } from './HelpButton';
import { HelpfulPrompt } from './HelpfulPrompt';
import { OtherRouteResults } from './OtherRouteResults';
import { SharePlace, ShareRoute } from './ShareRoute';
import { RouteFinder } from './RouteFinder';
import { GettingThere } from './GettingThere';
import { Notices } from './Notices';
import { accessSummary, hasAccessInfo, routeAccess } from '../lib/step-free';
import { ContinueWalk } from './ContinueWalk';
import { PlanVisit } from './PlanVisit';
import { isPlaceLink, isRouteLink, placeFromLocation, routeFromLocation, savedFromLocation } from '../lib/share';
import { askForCompass } from '../lib/useWalkSensors';
import { LazyBoundary } from './LazyBoundary';

import { L, byLang, nameOf, descriptionOf, highlightsOf, currentLang, fallbackLang, LANGS, LANGUAGES } from '../i18n/lang';
// The map (Leaflet, marker clustering and their CSS) is the largest part of the
// app, so it's loaded only when needed: in the background once the page is idle,
// or straight away if the map is opened first.
const loadMapView = () => import('./MapView');
// The printable route sheet (and its QR code library) load only when printing.
const RouteSheet = React.lazy(() => import('./RouteSheet'));
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

/** `list`, or the previous one when it holds the same items in the same order. */
function useSameList<T>(list: T[]): T[] {
  const previous = React.useRef(list);
  const same = previous.current.length === list.length && previous.current.every((item, i) => item === list[i]);
  if (!same) previous.current = list;
  return previous.current;
}

export const MainContent: React.FC = () => {
  // Live routes and places (admin edits), falling back to the bundled copy.
  const { places: locations, routes, specialPeriods } = useContent();
  const { t, language, setLanguage, dir } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  // Open now and Step-free (list and map). Open now is checked against the time, refreshed every minute.
  const [filters, setFilters] = useState<PlaceFilters>(NO_FILTERS);
  // The printable route sheet, while the print dialog is up. Each click is a new sheet
  // (a browser that never says the dialog closed doesn't block printing again).
  const [printing, setPrinting] = useState(0);
  const now = useNow();
  // Heat advice on the route: for a walk starting now (refreshed with the minute clock).
  const walkNow = useMemo(() => nextQuarter(now), [now]);
  const filtering = anyFilter(filters);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  // Each place whose card is opened goes to the top of Recently viewed (in the Saved sheet).
  useEffect(() => {
    if (selectedLocation !== null) addRecent(selectedLocation);
  }, [selectedLocation]);
  // Start on the route of a shared place (?loc=) or route (?route=), so the
  // first screen, and the route-open count, aren't briefly the first route.
  const [selectedRoute, setSelectedRoute] = useState<string>(() => {
    const id = placeFromLocation(window.location);
    return (
      locations.find(l => l.id === id)?.routeId ??
      routeFromLocation(window.location, routes.map(r => r.id)) ??
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
    const locId = placeFromLocation(window.location);
    if (locId !== null) {
      const loc = locations.find(l => l.id === locId);
      if (loc) {
        setSelectedRoute(loc.routeId);
        setSelectedLocation(loc.id);
        // The link is removed from the address once its route is showing
        // (see the route-open count below).
        
        setTimeout(() => {
          const el = document.getElementById(`location-${loc.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }, [locations]);

  // A shared route link (/r/<id> or ?route=<id>). Re-checked when the live
  // content arrives, so links to routes added in the admin work too. The
  // address goes back to the home page once the route is showing.
  useEffect(() => {
    const id = routeFromLocation(window.location, routes.map(r => r.id));
    if (!id) return;
    setSelectedRoute(id);
    setSelectedLocation(null);
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
      setShowScrollTop(window.scrollY > 1600); // after a long scroll; the tab bar is always there
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredRaw = useMemo(() => {
    return locations.filter(loc => {
      const matchesRoute = loc.routeId === selectedRoute;
      // Forgiving match (Arabic letter variants, vowel marks, punctuation); see lib/search.
      const matchesSearch = !searchQuery.trim() || matchScore(loc, searchQuery) > 0;
      const matchesCategory = selectedCategory === 'all' || loc.category === selectedCategory;
      // The open place stays, so its card doesn't vanish (e.g. when it closes while being read).
      const matchesFilters = loc.id === selectedLocation || passesFilters(loc, filters, now, specialPeriods);
      return matchesRoute && matchesSearch && matchesCategory && matchesFilters;
    });
    // `now` only matters while Open now is on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, selectedRoute, locations, filters, filters.openNow && now, specialPeriods, selectedLocation]);
  // The same array while the same places match, so the minute's clock tick (Open now) or
  // opening a place doesn't make the map re-fit or fly back while the visitor pans it.
  const filteredLocations = useSameList(filteredRaw);

  // While searching, matches on the other routes too, best first.
  const otherRouteMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const others = locations.filter(l => l.routeId !== selectedRoute && (selectedCategory === 'all' || l.category === selectedCategory) && passesFilters(l, filters, now, specialPeriods));
    return searchPlaces(others, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, selectedRoute, locations, filters, filters.openNow && now, specialPeriods]);
  // Places on this route (in the chosen category) that Open now leaves out for having no hours listed.
  const noHoursHidden = filters.openNow ? withoutHours(locations.filter(l => l.routeId === selectedRoute && (selectedCategory === 'all' || l.category === selectedCategory))) : 0;


  const isArabic = language === 'ar';
  const fontClass = isArabic ? 'font-arabic' : 'font-sans';
  const headingFontClass = isArabic ? 'font-arabic font-bold' : 'font-serif';
  const currentRouteData = routes.find(r => r.id === selectedRoute) || routes[0];
  // Memoized so "Near me" only resets its arrival state when the route changes.
  const routePlaces = useMemo(() => locations.filter(l => l.routeId === selectedRoute), [selectedRoute, locations]);
  const access = useMemo(() => routeAccess(locations, selectedRoute), [locations, selectedRoute]);
  // Anonymous count of which routes are opened (once per route per visit).
  // Choosing a route drops a shared link that never resolved (e.g. to a place
  // since deleted), so route opens are counted again from here on.
  // The route a shared link in the address asks for: undefined if there's no
  // link, null if it can't be resolved (yet, or ever).
  const sharedLinkTarget = (): string | null | undefined => {
    if (isPlaceLink(window.location)) return locations.find(l => l.id === placeFromLocation(window.location))?.routeId ?? null;
    if (isRouteLink(window.location)) return routeFromLocation(window.location, routes.map(r => r.id));
    return undefined;
  };
  const clearSharedLink = () => {
    if (sharedLinkTarget() !== undefined) window.history.replaceState({}, '', '/');
  };
  // Next walk (finish screen, passport): open that route at the top of the page.
  const showRoute = (id: string) => {
    clearSharedLink();
    setSelectedRoute(id);
    setSelectedLocation(null);
    setSelectedCategory('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // A shared link (?loc=, /r/, ?route=) may only resolve once the live content
  // arrives, and its route is selected a render later. Until the route it asks
  // for is the one showing, the route shown isn't the visitor's choice, so it
  // isn't counted; then the link leaves the address and that route is counted.
  useEffect(() => {
    const target = sharedLinkTarget();
    if (target !== undefined) {
      if (target !== selectedRoute) return;
      window.history.replaceState({}, '', '/');
    }
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
  // The finish screen: shown when the last stop of a route gets marked visited
  // (from a card, Near me or the walk), or from "Finish the walk". A route
  // completed during the walk waits for the walk to end, so the walk (with the
  // last stop's audio guide) and the summary are never open at once.
  const [finishedRoute, setFinishedRoute] = useState<string | null>(null);
  // The passport, opened from the finish screen's "See my passport".
  const [passportOpen, setPassportOpen] = useState(false);
  // A shared list of places (a `?saved=` link): shown once, then the address goes back to the home page.
  const [sharedIds, setSharedIds] = useState<number[] | null>(() => savedFromLocation(window.location));
  const closeShared = () => {
    setSharedIds(null);
    if (savedFromLocation(window.location)) window.history.replaceState({}, '', '/');
  };
  const finishAfterWalk = React.useRef<string | null>(null);
  const walkingRef = React.useRef(false);
  walkingRef.current = walking;
  const endWalk = () => {
    setWalking(false);
    if (walkStartedLocation.current) nearMe.stop();
    walkStartedLocation.current = false;
    if (finishAfterWalk.current) setFinishedRoute(finishAfterWalk.current);
    finishAfterWalk.current = null;
  };
  const visited = useVisited();
  const visitedBefore = React.useRef<{ places: unknown; counts: globalThis.Map<string, number> } | null>(null);
  useEffect(() => {
    // New content (e.g. the live copy arriving) only sets a new baseline, so a
    // route finished on an earlier visit never pops up on its own.
    const fresh = visitedBefore.current?.places !== locations;
    const counts = new globalThis.Map<string, number>(); // (Map is the map icon here)
    for (const r of routes) {
      const summary = walkSummary(locations, r.id, visited);
      counts.set(r.id, summary.visited);
      if (!fresh && justCompleted(visitedBefore.current!.counts.get(r.id) ?? null, summary)) {
        // The stamp goes in the passport now, with today's date, even if the
        // finish screen waits for the walk to end (and the page is closed first).
        stampRoute(r.id, cairoDate(new Date()), spotCount(locations, r.id, spotted.get()));
        if (walkingRef.current) finishAfterWalk.current = r.id;
        else setFinishedRoute(r.id);
      }
    }
    visitedBefore.current = { places: locations, counts };
  }, [visited, locations, routes]);
  const finishedRouteData = finishedRoute ? routes.find(r => r.id === finishedRoute) : undefined;

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


  // The list: the route's stops in walking order, then the other places
  // (cafés, workshops, meeting points). Each place is a compact row; the open
  // place shows its full card in place.
  const placeGroups = [
    { id: 'stops', title: L('Stops on the walk', 'محطات الجولة'), items: filteredLocations.filter(l => plan.has(l.id)) },
    { id: 'extras', title: L('Also nearby', 'أماكن أخرى قريبة'), items: filteredLocations.filter(l => !plan.has(l.id)) },
  ];

  const renderRow = (loc: (typeof locations)[number], index: number) => {
    const category = categories.find(c => c.id === loc.category);
    const info = plan.get(loc.id);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03 }}
        key={loc.id}
        id={`location-${loc.id}`}
        className="relative"
      >
        <button
          onClick={() => setSelectedLocation(loc.id)}
          aria-expanded={false}
          className="w-full flex items-center gap-4 p-3 pe-14 bg-white rounded-2xl border border-sand/40 shadow-sm text-start hover:border-nile/40 hover:shadow-md transition-all"
        >
          {/* Decorative here: the row's text names the place. */}
          <span aria-hidden="true" className="shrink-0">
            <PlacePhoto
              photo={photoForPlace(loc)}
              alt=""
              sizes="96px"
              tapToShow={false}
              className="w-20 h-20 rounded-xl"
              fallback={<HistoricPlaceholder category={loc.category} name={loc.nameEn} className="w-20 h-20 rounded-xl" />}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-[0.2em] text-gold-ink truncate">
              {info ? stopOfLabel(info.number, info.total) : category ? nameOf(category) : ''}
            </span>
            <span className={`block text-lg leading-snug text-ink truncate ${headingFontClass}`} lang={fallbackLang(loc, 'name')}>
              {nameOf(loc)}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <VisitedBadge placeId={loc.id} isArabic={isArabic} />
              <HoursBadge place={loc} />
              <PrayerNotice place={loc} compact />
            </span>
          </span>
          <ChevronRight className={`w-5 h-5 shrink-0 text-stone-300 ${isArabic ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {/* Beside the row's button, not inside it (a button can't hold another). */}
        <SaveToggle place={loc} className="absolute top-1/2 -translate-y-1/2 end-2" />
      </motion.div>
    );
  };

  // The full card: photo, details, audio, hours, actions. Shown for the open place.
  const renderFullCard = (loc: (typeof locations)[number], index: number) => {
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
                alt={photoAltOf(loc)}
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
                    <p className="text-xs font-bold text-gold-ink uppercase tracking-[0.3em]">
                      {(category ? nameOf(category) : undefined)}
                    </p>
                    <VisitedBadge placeId={loc.id} isArabic={isArabic} />
                  </div>
                  <h3 className={`text-3xl text-ink leading-tight ${headingFontClass}`} lang={fallbackLang(loc, 'name')}>
                    {nameOf(loc)}
                  </h3>
                  {plan.get(loc.id) && <div className="mt-2"><StopNumber info={plan.get(loc.id)!} isArabic={isArabic} /></div>}
                    <PlaceBadges place={loc} />
                </div>
                {plan.get(loc.id) && (
                  <div className="text-3xl font-serif text-gold-soft italic" aria-hidden="true">
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
                      <PlaceDetails place={loc} onOpenPlace={openPlace} />
                      <LiveLocationInfo locationId={loc.id} />
                      <HelpfulPrompt placeId={loc.id} className="mt-6" />

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
                        <SaveToggle place={loc} variant="full" className="py-4" />
                        <SharePlace place={loc} className="flex justify-center items-center py-4 px-6 bg-chalk hover:bg-sand/30 text-ink rounded-xl transition-all duration-300" />
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
  };

  return (
    <div className={`min-h-screen pb-20 ${fontClass}`}>
      {/* Header */}
      <header className="glass sticky top-0 z-[2000] px-4 sm:px-6 py-8 transition-all">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Logo className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 text-nile shrink-0" />
            <div className={`flex flex-col ${isArabic ? 'border-r-2 border-gold pr-3 sm:pr-4' : 'border-l-2 border-gold pl-3 sm:pl-4'}`}>
              <h1 className={`text-xl md:text-2xl text-ink font-bold ${headingFontClass}`}>
                {L('CAIRO', 'القاهرة')}
              </h1>
              <span className={`text-xs text-stone-500 uppercase font-medium whitespace-nowrap mt-0.5 ${isArabic ? 'tracking-[0.1em] sm:tracking-[0.2em]' : 'tracking-[0.15em] sm:tracking-[0.3em]'}`}>
                {L('Historic Explorer', 'مستكشف التاريخ')}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 shrink-0">
            <HelpButton route={currentRouteData} places={locations} />
            {/* Language, text size and contrast. */}
            <DisplaySettings />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-28 md:pb-8">
        <Notices scope={{ app: true }} className="mb-6" />
        {/* Breadcrumbs: only once a category or place is chosen (on the route's
            home view they'd repeat the header and the route title). */}
        {(selectedLocation !== null || selectedCategory !== 'all') && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-6 text-xs uppercase tracking-widest text-stone-400 font-bold pb-2">
          <span className="hover:text-nile cursor-pointer transition-colors" onClick={() => setSelectedLocation(null)}>{t('app.title')}</span>
          <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
          <span className="text-nile">{nameOf(currentRouteData)}</span>
          {selectedCategory !== 'all' && (
            <>
              <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
              <span className="text-gold-ink">{(() => { const c = categories.find(x => x.id === selectedCategory); return c ? nameOf(c) : ''; })()}</span>
            </>
          )}
          {selectedLocation && (
            <>
              <ChevronRight className={`w-3 h-3 ${isArabic ? 'rotate-180' : ''}`} />
              <span className="text-nile-light truncate max-w-[150px]">
                {(() => { const p = locations.find(l => l.id === selectedLocation); return p ? nameOf(p) : ''; })()}
              </span>
            </>
          )}
        </div>
        )}

        {/* A walk left part-way: pick it up at the next stop. */}
        {!walking && !finishedRouteData && (
          <ContinueWalk
            routes={routes}
            places={locations}
            currentRouteId={selectedRoute}
            onContinue={id => {
              clearSharedLink();
              setSelectedRoute(id);
              setSelectedLocation(null);
              startWalk();
            }}
          />
        )}

        {/* Route Selector */}
        <div className="mb-8">
          {/* Wraps when Passport and Saved don't fit beside the heading (narrow phones, large text). */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
            <h2 className="text-xs font-bold text-nile uppercase tracking-[0.25em]">
              {t('routes')}
            </h2>
            <div className="h-px flex-1 min-w-4 bg-sand/50"></div>
            <PassportButton routes={routes} places={locations} onShowRoute={showRoute} />
            <SavedButton places={locations} routes={routes} onOpen={openPlace} />
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
                    alt={nameOf(route)}
                    sizes="(min-width: 768px) 260px, 220px"
                    tapToShow={false}
                    priority={routeIndex < 2}
                    className="absolute inset-0 w-full h-full"
                    fallback={
                      <RoutePlaceholder 
                        routeId={route.id} 
                        name={nameOf(route)}
                        className="absolute inset-0 w-full h-full"
                      />
                    }
                  />
                  <div className={`absolute inset-0 bg-ink/20 transition-opacity duration-500 ${selectedRoute === route.id ? 'opacity-40' : 'opacity-20 group-hover:opacity-30'}`}></div>
                </button>
                <div className="text-center px-2">
                  <h3 className={`text-sm md:text-base text-ink ${headingFontClass}`}>
                    {nameOf(route)}
                  </h3>
                </div>
              </div>
            ))}
          </div>
          <RouteFinder
            routes={routes}
            places={locations}
            onPick={id => {
              clearSharedLink();
              setSelectedRoute(id);
              setSelectedLocation(null);
            }}
          />
          <ThroughTheAgesButton places={locations} routes={routes} onOpen={openPlace} />
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
            {/* On phones the actions come straight after the title and distance,
                so "Start the walk" is on the first screen, above the tab bar;
                the description and highlights follow. From sm up, the
                original order: description, highlights, then actions. */}
            <h2 className={`order-1 text-4xl md:text-5xl text-ink mb-2 ${headingFontClass}`}>
              {nameOf(currentRouteData)}
            </h2>

            <div className={`order-2 flex items-center gap-6 mb-5 sm:mb-6 text-xs font-bold uppercase tracking-widest text-nile`}>
              <div className="flex items-center gap-2">
                <RouteIcon className="w-3.5 h-3.5 text-gold" />
                <span>{formatDistance(currentRouteData.distanceKm, currentLang())}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gold" />
                <span>{formatDuration(currentRouteData.hoursMin, currentRouteData.hoursMax, currentLang())}</span>
              </div>
            </div>
            {hasAccessInfo(access) && (
              <p className="order-2 -mt-3 sm:-mt-4 mb-5 sm:mb-6 flex items-center gap-1.5 text-xs text-stone-600">
                <Accessibility className="w-3.5 h-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
                {accessSummary(access)}
              </p>
            )}

            <Notices scope={{ routeId: currentRouteData.id }} className="order-2 w-full max-w-md mb-5 sm:mb-6" />

            <p className="order-4 sm:order-3 text-stone-500 italic text-base md:text-lg leading-relaxed font-serif mb-6 sm:mb-8 line-clamp-3 sm:line-clamp-none">
              "{descriptionOf(currentRouteData)}"
            </p>

            <div className="order-5 sm:order-4 flex flex-wrap justify-center gap-2 sm:gap-3 mb-2 sm:mb-8">
              {(highlightsOf(currentRouteData)).map((highlight, i) => (
                <span key={i} className="px-3 sm:px-4 py-2 bg-chalk/80 text-stone-600 rounded-full text-xs font-bold uppercase tracking-wider border border-sand/30 flex items-center gap-2">
                  <Star className="w-3 h-3 text-gold fill-gold" />
                  {highlight}
                </span>
              ))}
            </div>

            <div className="order-3 sm:order-5 w-full flex flex-col items-center mb-6 sm:mb-0">
              <RouteProgress placeIds={[...plan.keys()]} clearIds={routePlaces.map(l => l.id)} isArabic={isArabic} />

              <div className="mb-4 flex w-full sm:w-auto flex-wrap justify-center gap-3">
              {plan.size > 0 && (
                <button
                  onClick={startWalk}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 min-h-12 px-6 py-3.5 rounded-2xl bg-nile text-white text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-nile-light transition-colors"
                >
                  <Footprints className="w-4 h-4" />
                  {L('Start the walk', 'ابدأ الجولة')}
                </button>
              )}
              {plan.size > 0 && <PlanVisit route={currentRouteData} places={locations} onOpenPlace={openPlace} compactOnPhone />}
              <ShareRoute route={currentRouteData} isArabic={isArabic} compactOnPhone />
              </div>

              {plan.size > 0 && (
                <WeatherAdvice
                  start={walkNow}
                  minutes={Math.round(currentRouteData.hoursMax * 60)}
                  breaks={breakCount(locations, currentRouteData.id)}
                  className="mb-3 max-w-md"
                />
              )}
              <GettingThere route={currentRouteData} places={locations} className="mb-3" />
              <RouteDownload route={currentRouteData} places={routePlaces} />
              {plan.size > 0 && (
                <button
                  type="button"
                  onClick={() => setPrinting(n => n + 1)}
                  className="mt-1 inline-flex items-center gap-1.5 min-h-11 px-3 text-xs font-bold text-nile underline underline-offset-4 hover:no-underline"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  {L('Print route sheet', 'طباعة ورقة المسار')}
                </button>
              )}
              {printing > 0 && (
                <React.Suspense fallback={null}>
                  <RouteSheet key={printing} route={currentRouteData} places={locations} onDone={() => setPrinting(0)} />
                </React.Suspense>
              )}
            </div>
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
                className={`flex-none flex items-center justify-center gap-2 min-h-11 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
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
                className={`flex-none flex items-center justify-center gap-2 min-h-11 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
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
                className={`flex-none flex items-center justify-center gap-2 min-h-11 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
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
              className={`flex-none snap-start min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
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
                  className={`flex-none snap-start flex items-center gap-2 min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-nile text-white shadow-lg shadow-nile/20'
                      : 'bg-chalk text-stone-500 hover:bg-sand/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 opacity-70" />
                  {nameOf(cat)}
                </button>
              );
            })}
          </div>

          {/* Open now and Step-free: toggles that work with the category and search. */}
          {viewMode !== 'near' && (
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={L('Filters', 'عوامل التصفية')}>
              {([
                { key: 'openNow', label: L('Open now', 'مفتوح الآن'), Icon: Clock },
                { key: 'stepFree', label: L('Step-free', 'بدون درجات'), Icon: Accessibility },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filters[key]}
                  onClick={() => setFilters(f => ({ ...f, [key]: !f[key] }))}
                  className={`flex items-center gap-1.5 min-h-11 px-4 rounded-full border text-xs font-bold transition-colors ${
                    filters[key] ? 'bg-nile/10 border-nile text-nile' : 'bg-white border-sand text-stone-600 hover:border-nile/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
              <EraFilter places={locations} value={filters.era} onChange={era => setFilters(f => ({ ...f, era }))} />
              {noHoursHidden > 0 && (
                <span className="text-xs text-stone-500">
                  {byLang({
                    en: `${noHoursHidden} without listed hours not shown`,
                    ar: `لا تظهر الأماكن التي لا مواعيد مسجلة لها (${noHoursHidden})`,
                    fr: `${noHoursHidden} sans horaires indiqués non affichés`,
                    es: `${noHoursHidden} sin horario indicado no se muestran`,
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        {viewMode === 'near' ? (
          <NearMeView
            nearMe={nearMe}
            routePlaces={routePlaces}
            allPlaces={locations}
            routeName={nameOf(currentRouteData)}
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
                      {L("The map couldn't load. Check your connection.", 'تعذّر تحميل الخريطة. تحقق من اتصالك بالإنترنت.')}
                    </p>
                    <button
                      // Browsers remember a failed module download, so retrying
                      // needs a reload (as Vite recommends for failed chunks).
                      onClick={() => window.location.reload()}
                      className="text-xs font-bold bg-nile text-white px-5 py-2 rounded-xl hover:bg-nile-light transition-all duration-300 uppercase tracking-wider"
                    >
                      {L('Try again', 'حاول مرة أخرى')}
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
                            alt={photoAltOf(loc)}
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
                                <h3 className={`text-4xl text-ink leading-tight ${headingFontClass}`} lang={fallbackLang(loc, 'name')}>
                                  {nameOf(loc)}
                                </h3>
                                <p className="text-xs font-bold text-nile mt-3 uppercase tracking-[0.3em]">
                                  {(category ? nameOf(category) : undefined)}
                                </p>
                                {plan.get(loc.id) && <div className="mt-2"><StopNumber info={plan.get(loc.id)!} isArabic={isArabic} /></div>}
                                <PlaceBadges place={loc} />
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
                            
                            <PlaceDetails place={loc} onOpenPlace={openPlace} />
                            <LiveLocationInfo locationId={loc.id} />
                            <HelpfulPrompt placeId={loc.id} className="mt-6" />
                            
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
                              <SaveToggle place={loc} variant="full" className="py-5 rounded-2xl" />
                              <SharePlace place={loc} className="flex justify-center items-center py-5 px-6 bg-chalk hover:bg-sand/30 text-ink rounded-2xl transition-all duration-300" />
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
          <div className="space-y-10">
            {placeGroups.map(group => group.items.length > 0 && (
              <section key={group.id} aria-labelledby={`group-${group.id}`}>
                <h3 id={`group-${group.id}`} className="flex items-center gap-3 mb-4 text-xs font-bold text-nile uppercase tracking-[0.25em]">
                  {group.title}
                  <span className="text-stone-400 tracking-normal">{group.items.length}</span>
                  <span className="h-px flex-1 bg-sand/50" aria-hidden="true" />
                </h3>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((loc, index) => (selectedLocation === loc.id ? renderFullCard(loc, index) : renderRow(loc, index)))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
            
            {filteredLocations.length === 0 && otherRouteMatches.length === 0 && (
              // Shorter with filters on, so "Clear filters" is in view on a phone.
              <div className={`text-center ${filtering ? 'py-10' : 'py-32'} bg-white rounded-[3rem] border border-dashed border-sand`}>
                <Search className={`${filtering ? 'w-8 h-8 mb-3' : 'w-12 h-12 mb-6'} text-stone-200 mx-auto`} />
                <h3 className={`${filtering ? 'text-xl' : 'text-3xl'} text-stone-400 ${headingFontClass}`}>
                  {L('No explorations found', 'لم يتم العثور على نتائج')}
                </h3>
                {filtering && (
                  <div className="mt-3 space-y-3 px-6">
                    <p className="text-sm text-stone-500">
                      {filters.era && (filters.openNow || filters.stepFree)
                        ? L('Nothing here matches these filters.', 'لا يوجد هنا مكان يطابق عوامل التصفية هذه.')
                        : filters.era
                          ? L('Nothing here from that era.', 'لا يوجد هنا مكان من هذا العصر.')
                          : filters.openNow && filters.stepFree
                            ? L('Nothing here is open now and step-free.', 'لا يوجد هنا مكان مفتوح الآن وبدون درجات.')
                            : filters.openNow
                              ? L('Nothing here is open now.', 'لا يوجد هنا مكان مفتوح الآن.')
                              : L('Nothing here is marked step-free.', 'لا يوجد هنا مكان مسجل بدون درجات.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters(NO_FILTERS)}
                      className="inline-flex items-center gap-1.5 min-h-11 px-5 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-wider hover:bg-nile-light"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      {L('Clear filters', 'إزالة عوامل التصفية')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {filteredLocations.length === 0 && otherRouteMatches.length > 0 && (
              <p className="text-center text-stone-500">
                {L('Nothing on this route, but there are matches on other routes:', 'لا نتائج في هذا المسار، لكن وجدنا أماكن في مسارات أخرى:')}
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
      {finishedRouteData && (
        <WalkFinish
          route={finishedRouteData}
          routes={routes}
          places={locations}
          onClose={() => setFinishedRoute(null)}
          onShowRoute={id => {
            setFinishedRoute(null);
            showRoute(id);
          }}
          onShowPassport={() => {
            setFinishedRoute(null);
            setPassportOpen(true);
          }}
        />
      )}
      {sharedIds && <SharedListSheet ids={sharedIds} places={locations} routes={routes} onOpen={openPlace} onClose={closeShared} />}
      {passportOpen && <PassportSheet routes={routes} places={locations} onClose={() => setPassportOpen(false)} onShowRoute={id => { setPassportOpen(false); showRoute(id); }} />}
      {walking && (
        <LazyBoundary
          key={walkAttempt}
          loading={null}
          failed={
            // The walk's code couldn't download (e.g. offline before it was cached):
            // say so, and give a way out that also turns location back off.
            <div className="fixed z-[7000] inset-x-4 bottom-28 md:bottom-8 md:inset-x-auto md:end-8 md:w-96 bg-white rounded-3xl shadow-2xl border border-sand/50 p-5" role="alert" dir={isArabic ? 'rtl' : 'ltr'}>
              <p className="text-sm text-ink mb-3">
                {L("The walk couldn't open. Check your connection, then reload the page.", 'تعذّر فتح الجولة. تحقق من اتصالك بالإنترنت، ثم أعد تحميل الصفحة.')}
              </p>
              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-widest">
                  {L('Reload', 'إعادة التحميل')}
                </button>
                <button onClick={endWalk} className="px-4 py-2 rounded-xl bg-chalk text-ink text-xs font-bold uppercase tracking-widest">
                  {L('Close', 'إغلاق')}
                </button>
              </div>
            </div>
          }
        >
          <WalkMode
            route={currentRouteData}
            places={locations}
            nearMe={nearMe}
            isArabic={isArabic}
            onClose={endWalk}
            onFinish={() => {
              endWalk();
              setFinishedRoute(currentRouteData.id);
            }}
          />
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
            aria-label={L('Back to top', 'العودة إلى الأعلى')}
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
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
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
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
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
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
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
