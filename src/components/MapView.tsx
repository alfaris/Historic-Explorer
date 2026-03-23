import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { Location, categories } from '../data/locations';
import { useLanguage } from '../i18n/LanguageContext';

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
const MapUpdater: React.FC<{ locations: Location[]; selectedLocation: number | null }> = ({ locations, selectedLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedLocation) {
      const loc = locations.find(l => l.id === selectedLocation);
      if (loc) {
        map.flyTo([loc.lat, loc.lng], 16, { animate: true });
      }
    } else if (locations.length > 0) {
      // Fit bounds to all locations if none selected
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [selectedLocation, locations, map]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({ locations, selectedLocation, onSelectLocation }) => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater locations={locations} selectedLocation={selectedLocation} />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
        >
          {locations.map((loc) => {
            const category = categories.find(c => c.id === loc.category);
            
            // Create a custom div icon with Tailwind classes
            const customIcon = L.divIcon({
              className: 'custom-leaflet-marker',
              html: `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white ${category?.color || 'bg-stone-500'} transition-transform hover:scale-110">
                      <div class="w-3 h-3 bg-white rounded-full opacity-50"></div>
                     </div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });

            // Generate a consistent placeholder image based on the location ID
            const getFallbackImage = () => {
              switch (loc.category) {
                case 'coffee': return 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=400&auto=format&fit=crop';
                case 'restaurant': return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=400&auto=format&fit=crop';
                case 'workshop': return 'https://images.unsplash.com/photo-1531053306735-59ce1e15566c?q=80&w=400&auto=format&fit=crop';
                case 'stationary': return 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?q=80&w=400&auto=format&fit=crop';
                case 'meeting': return 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?q=80&w=400&auto=format&fit=crop';
                case 'monument':
                default: return 'https://images.unsplash.com/photo-1539768942893-daf53e448371?q=80&w=400&auto=format&fit=crop';
              }
            };
            
            const imageUrl = loc.image || getFallbackImage();

            return (
              <Marker 
                key={loc.id} 
                position={[loc.lat, loc.lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => onSelectLocation(loc.id),
                }}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={1} className="custom-tooltip">
                  <div className="flex flex-col items-center gap-2 p-2 bg-white rounded-xl shadow-lg border border-stone-100">
                    <img 
                      src={imageUrl} 
                      alt={isArabic ? loc.nameAr : loc.nameEn} 
                      className="w-32 h-24 object-cover rounded-lg shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-center">
                      <p className="font-bold text-stone-900 text-xs">
                        {isArabic ? loc.nameAr : loc.nameEn}
                      </p>
                      <p className="text-[10px] text-stone-500">
                        {isArabic ? category?.nameAr : category?.nameEn}
                      </p>
                    </div>
                  </div>
                </Tooltip>
                <Popup className="custom-popup">
                  <div className="p-1">
                    <img 
                      src={imageUrl} 
                      alt={isArabic ? loc.nameAr : loc.nameEn} 
                      className="w-full h-32 object-cover rounded-lg shadow-sm mb-2"
                      referrerPolicy="no-referrer"
                    />
                    <h3 className="font-bold text-stone-900 text-sm mb-1">
                      {isArabic ? loc.nameAr : loc.nameEn}
                    </h3>
                    <p className="text-xs text-stone-500">
                      {isArabic ? category?.nameAr : category?.nameEn}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};
