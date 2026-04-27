import React from 'react';
import { MapPin, Compass, Landmark, Castle } from 'lucide-react';

interface RoutePlaceholderProps {
  routeId: string;
  name: string;
  className?: string;
}

const routeDecoration = {
  'ahl-al-bayt': { 
    icon: Landmark, 
    colors: 'from-nile via-nile-dark to-slate-900',
    pattern: 'radial-gradient(circle at 0px 0px, rgba(255,190,0,0.1) 1px, transparent 0)' 
  },
  'al-muizz': { 
    icon: Compass, 
    colors: 'from-gold via-orange-800 to-black',
    pattern: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)' 
  },
  'coptic-cairo': { 
    icon: MapPin, 
    colors: 'from-sky-700 via-indigo-900 to-slate-950',
    pattern: 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%)' 
  },
  'darb-al-ahmar': { 
    icon: Castle, 
    colors: 'from-stone-600 via-stone-800 to-black',
    pattern: 'radial-gradient(circle, rgba(255,255,255,0.03) 2px, transparent 0)' 
  }
};

export const RoutePlaceholder: React.FC<RoutePlaceholderProps> = ({ routeId, name, className = "" }) => {
  const config = routeDecoration[routeId as keyof typeof routeDecoration] || routeDecoration['ahl-al-bayt'];
  const Icon = config.icon;

  return (
    <div 
      id={`route-placeholder-${routeId}`}
      className={`relative overflow-hidden flex flex-col items-center justify-center p-8 bg-gradient-to-br ${config.colors} ${className}`}
    >
      {/* Texture Layer */}
      <div 
        className="absolute inset-0 opacity-20 mix-blend-overlay"
        style={{ 
          backgroundImage: config.pattern,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Decorative Border */}
      <div className="absolute inset-4 border border-white/10 rounded-lg pointer-events-none" />

      {/* Hero Icon */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="p-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 animate-pulse-slow">
          <Icon size={48} strokeWidth={1} className="text-white opacity-80" />
        </div>
      </div>

      {/* Decorative Accents */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
};
