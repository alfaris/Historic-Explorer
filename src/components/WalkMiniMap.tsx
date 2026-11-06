import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../lib/leaflet-fixes';
import { LocateFixed } from 'lucide-react';
import type { Location } from '../data/locations';
import { L as T, nameOf } from '../i18n/lang';

type Fix = { lat: number; lng: number; accuracy: number };

/**
 * Keeps the visitor and the next stop (or the current stop) in view as they
 * walk, until the visitor pans the map by hand; "Follow me" resumes it.
 */
function Follow({ points, following, onPan }: { points: [number, number][]; following: boolean; onPan: () => void }) {
  const map = useMap();
  useEffect(() => {
    const pan = () => onPan();
    map.on('dragstart', pan);
    return () => {
      map.off('dragstart', pan);
    };
  }, [map, onPan]);
  const key = points.map(p => p.join(',')).join('|');
  useEffect(() => {
    if (!following || points.length === 0) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 17, { animate: true });
      else map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 18, animate: true });
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, following]);
  return null;
}

/**
 * Walk mode's small map: the route line, the stops (the current and next
 * highlighted), and the visitor's position and its accuracy. Uses the same
 * OpenStreetMap tiles as the main map, so a downloaded route works offline.
 */
export default function WalkMiniMap({ stops, current, next, fix }: { stops: Location[]; current: Location; next: Location | null; fix: Fix | null }) {
  const [following, setFollowing] = useState(true);
  const onPan = useRef(() => setFollowing(false)).current;
  // A new stop: follow again, even after panning around the last one.
  useEffect(() => setFollowing(true), [current.id]);
  const line = useMemo(() => stops.map(s => [s.lat, s.lng] as [number, number]), [stops]);
  const target = next ?? current;
  const points: [number, number][] = fix ? [[fix.lat, fix.lng], [target.lat, target.lng]] : next ? [[current.lat, current.lng], [next.lat, next.lng]] : [[current.lat, current.lng]];

  return (
    <div className="relative z-0 h-52 overflow-hidden rounded-2xl border border-sand/60" role="region" aria-label={T('Map of the walk', 'خريطة الجولة')}>
      <MapContainer center={[current.lat, current.lng]} zoom={16} zoomControl={false} attributionControl style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Polyline positions={line} pathOptions={{ color: '#c49a6c', weight: 4, opacity: 0.7, dashArray: '6, 10', lineJoin: 'round' }} />
        {stops.map(s => {
          const isCurrent = s.id === current.id;
          const isNext = s.id === next?.id;
          return (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={isCurrent || isNext ? 9 : 5}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: isCurrent ? '#1a4d3b' : isNext ? '#c5a059' : '#8a8178',
                fillOpacity: isCurrent || isNext ? 1 : 0.6,
              }}
            >
              {(isCurrent || isNext) && (
                <Tooltip direction="top" offset={[0, -8]} permanent>
                  <span className="text-xs font-bold">{nameOf(s)}</span>
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
        {fix && (
          <>
            <Circle center={[fix.lat, fix.lng]} radius={fix.accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 }} />
            <CircleMarker center={[fix.lat, fix.lng]} radius={7} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
              <Tooltip direction="bottom" offset={[0, 6]}>
                <span className="text-xs font-bold">{T('Your Location', 'موقعك الحالي')}</span>
              </Tooltip>
            </CircleMarker>
          </>
        )}
        <Follow points={points} following={following} onPan={onPan} />
      </MapContainer>
      {!following && (
        <button
          type="button"
          onClick={() => setFollowing(true)}
          className="absolute top-2 end-2 z-[500] flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white/95 border border-sand shadow text-xs font-bold text-nile"
        >
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
          {T('Follow me', 'تتبّع موقعي')}
        </button>
      )}
    </div>
  );
}
