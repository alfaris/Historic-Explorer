import React from 'react';
import { Accessibility, Camera, CameraOff, Footprints, Info, Shirt, Toilet } from 'lucide-react';
import type { Location } from '../data/locations';
import { effectiveTips, tipLines, type TipIcon } from '../lib/visitor-tips';
import { L, currentLang } from '../i18n/lang';

const ICONS: Record<TipIcon, React.ComponentType<{ className?: string }>> = {
  dress: Shirt,
  shoes: Footprints,
  camera: Camera,
  cameraOff: CameraOff,
  access: Accessibility,
  toilet: Toilet,
  note: Info,
};

/** "Visitor tips": dress, shoes, photos, access, toilets and a note. Nothing when there are none. */
export function VisitorTips({ place, className = 'mb-6' }: { place: Location; className?: string }) {
  const tips = effectiveTips(place);
  const lines = tips ? tipLines(tips, currentLang()) : [];
  if (!lines.length) return null;
  return (
    <section className={`rounded-2xl border border-sand/60 bg-chalk/50 p-4 ${className}`} aria-label={L('Visitor tips', 'نصائح للزيارة')}>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-500">{L('Visitor tips', 'نصائح للزيارة')}</p>
      <ul className="space-y-1.5 text-sm text-stone-700">
        {lines.map((line, i) => {
          const Icon = ICONS[line.icon];
          return (
            <li key={i} className="flex items-start gap-2">
              <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gold" aria-hidden="true" />
              <span lang={line.lang}>{line.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
