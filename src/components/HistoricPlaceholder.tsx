import React from 'react';
import { Landmark, Coffee, Utensils, Hammer, BookOpen, Users, HelpCircle } from 'lucide-react';
import { Category } from '../data/locations';

interface HistoricPlaceholderProps {
  category: Category;
  name: string;
  className?: string;
}

const iconMap = {
  monument: Landmark,
  coffee: Coffee,
  restaurant: Utensils,
  workshop: Hammer,
  stationary: BookOpen,
  meeting: Users,
};

const patternMap: Record<Category, string> = {
  monument: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
  coffee: 'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, transparent 75%, transparent)',
  restaurant: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
  workshop: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px)',
  stationary: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 10px)',
  meeting: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 10%, transparent 10.2%)',
};

const colorMap: Record<Category, string> = {
  monument: 'from-nile to-nile-dark',
  coffee: 'from-stone-600 to-stone-800',
  restaurant: 'from-gold to-orange-700',
  workshop: 'from-stone-700 to-stone-900',
  stationary: 'from-stone-500 to-stone-700',
  meeting: 'from-nile-light to-nile',
};

export const HistoricPlaceholder: React.FC<HistoricPlaceholderProps> = ({ category, name, className = "" }) => {
  const Icon = iconMap[category] || HelpCircle;
  const pattern = patternMap[category] || '';
  const colors = colorMap[category] || 'from-gray-500 to-gray-700';

  return (
    <div 
      id={`placeholder-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className={`relative overflow-hidden flex items-center justify-center bg-gradient-to-br ${colors} ${className}`}
    >
      {/* Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{ 
          backgroundImage: pattern,
          backgroundSize: category === 'monument' ? '20px 20px' : '15px 15px'
        }}
      />
      
      {/* Central Illustration Area */}
      <div className="relative z-10 flex flex-col items-center gap-2 text-white/90 drop-shadow-lg">
        <Icon size={48} strokeWidth={1} className="opacity-80" />
        <span className="text-[10px] font-mono tracking-widest uppercase opacity-40 select-none">
          {category}
        </span>
      </div>

      {/* Atmospheric Glow */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute -top-10 -left-10 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
    </div>
  );
};
