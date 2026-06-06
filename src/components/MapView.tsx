import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline, ScaleControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { MapPin, ZoomIn, ZoomOut, Layers, Compass } from 'lucide-react';
import { Location, categories } from '../data/locations';
import { useLanguage } from '../i18n/LanguageContext';
import { HistoricPlaceholder } from './HistoricPlaceholder';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  locations: Location[];
  selectedLocation: number | null;
  onSelectLocation: (id: number) => void;
}

// Component to handle map center updates when selection changes
const MapUpdater: React.FC<{ locations: Location[]; selectedLocation: number | null, userLocation: [number, number] | null }> = ({ locations, selectedLocation, userLocation }) => {
  const map = useMap();
  const hasCenteredOnUser = useRef(false);

  useEffect(() => {
    // Force map to acknowledge container size on mount
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    if (selectedLocation) {
      const loc = locations.find(l => l.id === selectedLocation);
      if (loc) {
        map.flyTo([loc.lat, loc.lng], 17, { animate: true, duration: 1.5 });
      }
    } else if (userLocation && !hasCenteredOnUser.current) {
      map.flyTo(userLocation, 14, { animate: true });
      hasCenteredOnUser.current = true;
    } else if (locations.length > 0 && !hasCenteredOnUser.current) {
      // Fit bounds to all locations if none selected
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [selectedLocation, locations, map, userLocation]);

  return null;
};

// Custom Zoom Controls
const CustomZoomControl: React.FC = () => {
  const map = useMap();
  return (
    <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center justify-center text-nile hover:bg-gold hover:text-white transition-all duration-300"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center justify-center text-nile hover:bg-gold hover:text-white transition-all duration-300"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
    </div>
  );
};

// Compass Component 
const CompassOverlay: React.FC<{ isArabic: boolean }> = ({ isArabic }) => {
  return (
    <div className={`absolute top-6 ${isArabic ? 'right-20' : 'left-6'} z-[1000] pointer-events-none opacity-40 hover:opacity-100 transition-opacity`}>
      <div className="relative flex flex-col items-center">
        <div className="text-[10px] font-bold text-nile mb-1">N</div>
        <Compass className="w-8 h-8 text-nile animate-[spin_10s_linear_infinite_paused]" strokeWidth={1} />
        <div className="w-px h-8 bg-gold/30 my-2"></div>
      </div>
    </div>
  );
};

// Component for the Locate Me button
const LocateControl: React.FC<{ onLocate: () => void, isLocating: boolean, isArabic: boolean }> = ({ onLocate, isLocating, isArabic }) => {
  return (
    <div className={`absolute bottom-6 ${isArabic ? 'left-6' : 'right-6'} z-[1000]`}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate(); }}
        className="w-12 h-12 bg-nile text-white rounded-full shadow-xl border-2 border-white flex items-center justify-center hover:bg-nile-light hover:scale-110 transition-all active:scale-95 focus:outline-none"
        title={isArabic ? 'موقعي الحالي' : 'My Location'}
        disabled={isLocating}
      >
        <MapPin className={`w-5 h-5 ${isLocating ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = ({ locations, selectedLocation, onSelectLocation }) => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapStyle, setMapStyle] = useState<'voyager' | 'antique'>('voyager');
  
  const mapRef = useRef<L.Map>(null);

  const locateUser = () => {
    if (!navigator.geolocation) {
      alert(isArabic ? 'تحديد الموقع غير مدعوم في هذا المتصفح' : 'Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setIsLocating(false);
        if (mapRef.current) {
          mapRef.current.flyTo([latitude, longitude], 15, { animate: true });
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsLocating(false);
        alert(isArabic ? 'تعذر الوصول إلى موقعك' : 'Unable to retrieve your location');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  // Filter locations to draw the main route line (monuments only)
  const routePoints = React.useMemo(() => {
    return locations
      .filter(l => l.category === 'monument')
      .sort((a, b) => a.id - b.id)
      .map(l => [l.lat, l.lng] as [number, number]);
  }, [locations]);

  const markers = React.useMemo(() => {
    return locations.map((loc, idx) => {
      const category = categories.find(c => c.id === loc.category);
      const isSelected = selectedLocation === loc.id;
      
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="group relative flex items-center justify-center transition-all duration-300 animate-[fade-in_0.5s_ease-out_forwards]" style="animation-delay: ${idx * 50}ms">
                <div class="absolute -inset-2 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white ${category?.color || 'bg-nile'} transition-all duration-500 ${isSelected ? 'marker-selected scale-125 ring-4 ring-gold/30 ring-offset-2' : 'hover:scale-125'}">
                  <div class="w-1.5 h-1.5 bg-white rounded-full shadow-sm animate-pulse"></div>
                </div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      return (
        <Marker 
          key={loc.id} 
          position={[loc.lat, loc.lng]}
          icon={customIcon as L.DivIcon}
          eventHandlers={{
            click: () => onSelectLocation(loc.id),
          }}
        >
          <Tooltip direction="top" offset={[0, -20]} opacity={1} className="custom-tooltip">
            <div className="flex flex-col items-center gap-3 p-3 bg-white rounded-2xl shadow-2xl border border-sand/50 max-w-[160px]">
              <HistoricPlaceholder 
                category={loc.category} 
                name={loc.nameEn}
                className="w-full h-12 rounded-xl shadow-md"
              />
              <div className="text-center px-1">
                <p className="font-bold text-nile text-[10px] leading-tight text-balance uppercase tracking-wider">
                  {isArabic ? loc.nameAr : loc.nameEn}
                </p>
              </div>
            </div>
          </Tooltip>
          <Popup className="custom-popup">
            <div className="p-4 bg-[#fdfcf8] min-w-[240px]">
              <HistoricPlaceholder 
                category={loc.category} 
                name={loc.nameEn}
                className="w-full h-40 rounded-xl mb-4 shadow-sm border border-sand/30"
              />
              <div className="px-1">
                <p className="text-[10px] font-bold text-gold mb-2 uppercase tracking-[0.2em]">
                  {isArabic ? category?.nameAr : category?.nameEn}
                </p>
                <h3 className="font-serif italic text-xl text-ink leading-tight mb-2">
                  {isArabic ? loc.nameAr : loc.nameEn}
                </h3>
                <div className="w-8 h-px bg-gold/30 mb-3"></div>
                <button 
                  onClick={() => onSelectLocation(loc.id)}
                  className="text-[10px] font-bold text-nile underline underline-offset-4 uppercase tracking-widest hover:text-gold transition-colors"
                >
                  {isArabic ? 'بدء الاستماع' : 'Start Lesson'}
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [locations, isArabic, onSelectLocation, selectedLocation]);

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg overflow-visible">
             <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const defaultCenter: [number, number] = [30.0444, 31.2357];

  return (
    <div className="w-full h-[400px] md:h-[600px] rounded-[2.5rem] overflow-hidden shadow-2xl border border-stone-200 relative group z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        whenReady={() => {
          setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
          }, 250);
        }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={mapStyle === 'voyager' 
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
        />
        
        {/* Stylized Overlay Tile for Antique look */}
        {mapStyle === 'antique' && (
          <>
            <div className="absolute inset-0 bg-gold/15 mix-blend-multiply pointer-events-none z-[400] transition-opacity duration-1000"></div>
            <div className="absolute inset-0 map-paper-texture z-[401]"></div>
          </>
        )}

        <MapUpdater locations={locations} selectedLocation={selectedLocation} userLocation={userLocation} />

        <ScaleControl position="bottomleft" />

        <Polyline 
          positions={routePoints}
          pathOptions={{ 
            color: '#c49a6c', // gold-sand color
            weight: 3, 
            opacity: 0.6,
            dashArray: '8, 12',
            lineJoin: 'round'
          }} 
        />
        
        {/* Shadow/Glow effect for Route */}
        <Polyline 
          positions={routePoints}
          pathOptions={{ 
            color: '#c49a6c', 
            weight: 12, 
            opacity: 0.1,
            lineJoin: 'round'
          }} 
        />

        {userLocation && (
          <Marker position={userLocation} icon={userIcon as L.DivIcon} zIndexOffset={1000}>
            <Tooltip direction="top" opacity={1}>
              <span className="font-bold">{isArabic ? 'موقعك الحالي' : 'Your Location'}</span>
            </Tooltip>
          </Marker>
        )}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
        >
          {markers}
        </MarkerClusterGroup>

        <CustomZoomControl />
        <CompassOverlay isArabic={isArabic} />
      </MapContainer>
      
      {/* Map Style Toggle */}
      <button 
        onClick={() => setMapStyle(prev => prev === 'voyager' ? 'antique' : 'voyager')}
        className={`absolute bottom-6 ${isArabic ? 'right-6' : 'left-6'} z-[1000] px-4 py-2 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-nile hover:bg-stone-50 transition-all hover:scale-105 active:scale-95`}
      >
        <Layers className="w-4 h-4" />
        {isArabic ? (mapStyle === 'voyager' ? 'نمط قديم' : 'نمط حديث') : (mapStyle === 'voyager' ? 'Antique Map' : 'Modern Map')}
      </button>

      <LocateControl onLocate={locateUser} isLocating={isLocating} isArabic={isArabic} />
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-gold/40 pointer-events-none rounded-tl-[2.5rem] m-6 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-gold/40 pointer-events-none rounded-br-[2.5rem] m-6 opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </div>
  );
};


