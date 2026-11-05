import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '../lib/leaflet-fixes';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: LatLng;
  onChange: (value: LatLng) => void;
  /** Optional second marker, e.g. a place's current position. */
  reference?: LatLng;
  height?: number;
}

// A plain pin drawn with CSS, so no marker images need to load.
const pin = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
const chosenPin = pin('#c9a227');
const referencePin = pin('#9ca3af');

const round = (n: number) => +n.toFixed(6);

function ClickToMove({ onChange }: { onChange: (v: LatLng) => void }) {
  useMapEvents({ click: e => onChange({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }) });
  return null;
}

/** Keeps the chosen point in view when it changes from outside (e.g. GPS). */
function FollowValue({ value }: { value: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().pad(-0.2).contains([value.lat, value.lng])) map.panTo([value.lat, value.lng]);
  }, [map, value.lat, value.lng]);
  return null;
}

/**
 * A small map for choosing a spot: tap the map or drag the gold pin. Loaded
 * lazily (it pulls in Leaflet), by the report form and the admin editor.
 */
export default function LocationPicker({ value, onChange, reference, height = 260 }: LocationPickerProps) {
  return (
    <div style={{ height }} className="rounded-2xl overflow-hidden border border-sand/60 relative z-0">
      <MapContainer center={[value.lat, value.lng]} zoom={17} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reference && <Marker position={[reference.lat, reference.lng]} icon={referencePin} interactive={false} />}
        <Marker
          position={[value.lat, value.lng]}
          icon={chosenPin}
          draggable
          eventHandlers={{
            dragend: e => {
              const p = (e.target as L.Marker).getLatLng();
              onChange({ lat: round(p.lat), lng: round(p.lng) });
            },
          }}
        />
        <ClickToMove onChange={onChange} />
        <FollowValue value={value} />
      </MapContainer>
    </div>
  );
}
