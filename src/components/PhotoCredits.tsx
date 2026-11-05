import React, { useState } from 'react';
import { X } from 'lucide-react';
import { photos } from '../data/photos';
import { locations, routes } from '../data/locations';

// The photos come from Wikimedia Commons under licenses that require credit,
// so every one is listed here with its author, license and source.
export function PhotoCredits({ isArabic }: { isArabic: boolean }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(photos);
  if (entries.length === 0) return null;

  const nameFor = (key: string) => {
    const [kind, id] = [key.slice(0, key.indexOf('-')), key.slice(key.indexOf('-') + 1)];
    if (kind === 'route') {
      const route = routes.find(r => r.id === id);
      return route ? (isArabic ? route.nameAr : route.nameEn) : id;
    }
    const place = locations.find(l => l.id === Number(id));
    return place ? (isArabic ? place.nameAr : place.nameEn) : id;
  };

  return (
    <>
      <div className="text-center pb-32 md:pb-12">
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 hover:text-nile transition-colors"
        >
          {isArabic ? 'حقوق الصور' : 'Photo credits'}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[5000] bg-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={isArabic ? 'حقوق الصور' : 'Photo credits'}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-sand/40">
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-nile">
                {isArabic ? 'حقوق الصور' : 'Photo credits'}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 -m-2 text-stone-400 hover:text-ink"
                aria-label={isArabic ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-6 pt-4 text-xs text-stone-500">
              {isArabic
                ? 'الصور من ويكيميديا كومنز، ومستخدمة وفق التراخيص المذكورة. تم تصغيرها.'
                : 'Photos from Wikimedia Commons, used under the licenses listed. Resized for the app.'}
            </p>
            <ul className="overflow-y-auto px-6 py-4 space-y-3 text-xs">
              {entries.map(([key, photo]) => (
                <li key={key} className="border-b border-sand/20 pb-3 last:border-0">
                  <p className="font-bold text-ink">{nameFor(key)}</p>
                  <p className="text-stone-500" dir="ltr">
                    <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-nile">
                      {photo.author}
                    </a>
                    {' · '}
                    {photo.licenseUrl ? (
                      <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-nile">
                        {photo.license}
                      </a>
                    ) : (
                      photo.license
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
