import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useContent } from '../data/ContentContext';
import { photoForPlace, photoForRoute } from '../data/photo-resolve';
import type { Photo } from '../data/photos';

import { L, nameOf } from '../i18n/lang';
// Every photo shown in the app, built-in (Wikimedia Commons) or uploaded in the
// admin dashboard, listed with the credit its license requires.
export function PhotoCredits({ isArabic }: { isArabic: boolean }) {
  const [open, setOpen] = useState(false);
  const { places: locations, routes } = useContent();
  const entries: [string, string, Photo][] = [];
  for (const r of routes) {
    const photo = photoForRoute(r);
    if (photo) entries.push([`route-${r.id}`, nameOf(r), photo]);
  }
  for (const l of locations) {
    const photo = photoForPlace(l);
    if (photo) entries.push([`place-${l.id}`, nameOf(l), photo]);
  }
  if (entries.length === 0) return null;

  return (
    <>
      <div className="text-center pb-32 md:pb-12">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center min-h-11 px-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-400 hover:text-nile transition-colors"
        >
          {L('Photo credits', 'حقوق الصور')}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[5000] bg-ink/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={L('Photo credits', 'حقوق الصور')}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-sand/40">
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-nile">
                {L('Photo credits', 'حقوق الصور')}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-2 -m-2 text-stone-400 hover:text-ink"
                aria-label={L('Close', 'إغلاق')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="px-6 pt-4 text-xs text-stone-500">
              {L('Photos from Wikimedia Commons and other contributors, used under the licenses listed.', 'الصور من ويكيميديا كومنز ومساهمين آخرين، ومستخدمة وفق التراخيص المذكورة.')}
            </p>
            <ul className="overflow-y-auto px-6 py-4 space-y-3 text-xs">
              {entries.map(([key, name, photo]) => (
                <li key={key} className="border-b border-sand/20 pb-3 last:border-0">
                  <p className="font-bold text-ink">{name}</p>
                  <p className="text-stone-500" dir="ltr">
                    {photo.sourceUrl ? (
                      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-nile">
                        {photo.author}
                      </a>
                    ) : (
                      photo.author
                    )}
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
