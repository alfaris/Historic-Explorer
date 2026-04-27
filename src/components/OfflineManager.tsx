import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, WifiOff } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Location } from '../data/locations';

// Tile calculation
const lng2tile = (lon: number, zoom: number) => {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
};

const lat2tile = (lat: number, zoom: number) => {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
};

interface OfflineManagerProps {
  locations: Location[];
  routeName: string;
}

export const OfflineManager: React.FC<OfflineManagerProps> = ({ locations, routeName }) => {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const downloadTiles = async () => {
    if (locations.length === 0) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    
    // Add a small buffer around the min max locations bounding box
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;

    const urlsToCache: string[] = [];
    const zooms = [15, 16, 17]; // The zoom levels to cache
    
    for (const z of zooms) {
      const minX = lng2tile(minLng, z);
      const maxX = lng2tile(maxLng, z);
      const minY = lat2tile(maxLat, z);
      const maxY = lat2tile(minLat, z);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const subdomain = ['a', 'b', 'c'][Math.abs(x + y) % 3];
          urlsToCache.push(`https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
        }
      }
    }

    // Add location images 
    locations.filter(l => l.image).forEach(l => {
      if (l.image) {
        urlsToCache.push(l.image);
      }
    });

    // Limit to 500 items max just in case
    const limit = Math.min(urlsToCache.length, 500);
    
    let successCount = 0;
    
    // Cache the tiles
    for (let i = 0; i < limit; i++) {
      try {
        await fetch(urlsToCache[i], { mode: 'no-cors' });
        successCount++;
      } catch (err) {
        console.error('Failed to download tile', err);
      }
      setDownloadProgress(Math.round(((i + 1) / limit) * 100));
    }

    // Attempt to open the custom cache just to tag this route
    try {
      const cache = await window.caches.open('saved-routes');
      await cache.put(`/route-${routeName}`, new Response('ready'));
    } catch(e) {}
    
    setIsDownloading(false);
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  return (
    <div className="flex items-center gap-2">
      {isOffline && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-500 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0">
          <WifiOff className="w-3.5 h-3.5" />
          {isArabic ? 'غير متصل بالإنترنت' : 'Offline Mode'}
        </div>
      )}
      <button
        onClick={downloadTiles}
        disabled={isDownloading || isOffline}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all
          ${isDownloaded 
            ? 'bg-nile text-white shadow-lg' 
            : isDownloading 
              ? 'bg-chalk text-stone-400 cursor-not-allowed border border-sand/50' 
              : isOffline
                ? 'opacity-50 cursor-not-allowed bg-chalk text-stone-400'
                : 'bg-white border border-sand hover:border-nile text-ink shadow-sm group'
          }
        `}
      >
        {isDownloaded ? (
          <>
            <CheckCircle className="w-4 h-4" />
            {isArabic ? 'تم التنزيل' : 'Downloaded'}
          </>
        ) : isDownloading ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-400 animate-spin"></div>
            {isArabic ? 'جاري التنزيل' : 'Downloading'} {downloadProgress}%
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-stone-400 group-hover:text-nile transition-colors" />
            {isArabic ? 'تحميل الخريطة' : 'Download Map'}
          </>
        )}
      </button>
    </div>
  );
};
