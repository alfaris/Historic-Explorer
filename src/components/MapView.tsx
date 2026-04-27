import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
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
        map.flyTo([loc.lat, loc.lng], 16, { animate: true });
      }
    } else if (userLocation && !hasCenteredOnUser.current) {
      map.flyTo(userLocation, 14, { animate: true });
      hasCenteredOnUser.current = true;
    } else if (locations.length > 0 && !hasCenteredOnUser.current) {
      // Fit bounds to all locations if none selected
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [selectedLocation, locations, map, userLocation]);

  return null;
};

// Component for the Locate Me button
const LocateControl: React.FC<{ onLocate: () => void, isLocating: boolean }> = ({ onLocate, isLocating }) => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  return (
    <div className={`absolute bottom-6 ${isArabic ? 'left-6' : 'right-6'} z-[1000]`}>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLocate(); }}
        className="w-12 h-12 bg-white rounded-full shadow-lg border border-stone-200 flex items-center justify-center text-ink hover:text-nile hover:bg-stone-50 transition-colors focus:outline-none"
        title={isArabic ? 'موقعي الحالي' : 'My Location'}
        disabled={isLocating}
      >
        <MapPin className={`w-5 h-5 ${isLocating ? 'animate-pulse text-stone-400' : ''}`} />
      </button>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = ({ locations, selectedLocation, onSelectLocation }) => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
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
    // Try to get location on initial load silently
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        () => {
          // ignore errors on silent initial load
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  const markers = React.useMemo(() => {
    return locations.map((loc) => {
      const category = categories.find(c => c.id === loc.category);
      const isSelected = selectedLocation === loc.id;
      
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white ${category?.color || 'bg-nile'} transition-all duration-500 ${isSelected ? 'marker-selected scale-125' : 'hover:scale-125'}">
                <div class="w-1.5 h-1.5 bg-white rounded-full shadow-sm"></div>
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

  const userIcon = React.useMemo(() => {
    return L.divIcon({
      className: 'user-location-marker',
      html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg overflow-visible animate-pulse">
               <div class="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  // Default center (Cairo roughly)
  const defaultCenter: [number, number] = [30.0444, 31.2357];

  if (locations.length === 0) {
    return (
      <div className="w-full h-[600px] bg-stone-100 rounded-[2rem] flex items-center justify-center">
        <p className="text-stone-500">{isArabic ? 'لا توجد مواقع لعرضها' : 'No locations to display'}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] rounded-[2rem] overflow-hidden shadow-sm border border-stone-200 relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater locations={locations} selectedLocation={selectedLocation} userLocation={userLocation} />

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
      </MapContainer>
      
      <LocateControl onLocate={locateUser} isLocating={isLocating} />
    </div>
  );
};
