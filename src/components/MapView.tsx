import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { MapPin, ZoomIn, ZoomOut, Layers } from 'lucide-react';
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
        className="w-10 h-10 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center justify-center text-nile hover:bg-stone-50 transition-colors"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center justify-center text-nile hover:bg-stone-50 transition-colors"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
    </div>
  );
};

// Component for the Locate Me button
const LocateControl: React.FC<{ onLocate: () => void, isLocating: boolean, isArabic: boolean }> = ({ onLocate, isLocating, isArabic }) => {
  return (
    <div className={`absolute bottom-6 ${isArabic ? 'left-6' : 'right-6'} z-[1000]`}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate(); }}
        className="w-12 h-12 bg-nile text-white rounded-full shadow-xl border-2 border-white flex items-center justify-center hover:bg-nile/90 transition-all active:scale-95 focus:outline-none"
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
    return locations.map((loc) => {
      const category = categories.find(c => c.id === loc.category);
      const isSelected = selectedLocation === loc.id;
      
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="group relative flex items-center justify-center transition-all duration-300">
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
            <div className="p-3 bg-white">
              <HistoricPlaceholder 
                category={loc.category} 
                name={loc.nameEn}
                className="w-full h-40 rounded-xl mb-4"
              />
              <p className="text-[10px] font-bold text-gold mb-2 uppercase tracking-[0.2em]">
                {isArabic ? category?.nameAr : category?.nameEn}
              </p>
              <h3 className="font-serif italic text-lg text-ink leading-tight">
                {isArabic ? loc.nameAr : loc.nameEn}
              </h3>
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
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" // Using Light All as base for stylized look
          }
        />
        
        {/* Stylized Overlay Tile for Antique look */}
        {mapStyle === 'antique' && (
          <div className="absolute inset-0 bg-gold/10 mix-blend-multiply pointer-events-none z-[400] transition-opacity duration-1000"></div>
        )}

        <MapUpdater locations={locations} selectedLocation={selectedLocation} userLocation={userLocation} />

        <Polyline 
          positions={routePoints}
          pathOptions={{ 
            color: '#c49a6c', // gold-sand color
            weight: 4, 
            opacity: 0.6,
            dashArray: '10, 10',
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
      </MapContainer>
      
      {/* Map Style Toggle */}
      <button 
        onClick={() => setMapStyle(prev => prev === 'voyager' ? 'antique' : 'voyager')}
        className={`absolute bottom-6 ${isArabic ? 'right-6' : 'left-6'} z-[1000] px-4 py-2 bg-white rounded-xl shadow-lg border border-stone-200 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-nile hover:bg-stone-50 transition-all`}
      >
        <Layers className="w-4 h-4" />
        {isArabic ? (mapStyle === 'voyager' ? 'نمط قديم' : 'نمط حديث') : (mapStyle === 'voyager' ? 'Antique Map' : 'Modern Map')}
      </button>

      <LocateControl onLocate={locateUser} isLocating={isLocating} isArabic={isArabic} />
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-gold/20 pointer-events-none rounded-tl-[2.5rem] m-6"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-gold/20 pointer-events-none rounded-br-[2.5rem] m-6"></div>
    </div>
  );
};

