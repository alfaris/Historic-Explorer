import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { categories } from '../data/locations';
import type { Content, Location } from '../data/content';
import { ContentValue } from '../data/ContentContext';
import { photoAltOf, photoForPlace } from '../data/photo-resolve';
import { LANGS, LANGUAGES, descriptionOf, fallbackLang, loadDictionary, nameOf, setCurrentLang, type Lang } from '../i18n/lang';
import { useDialog } from '../lib/useDialog';
import { HistoricPlaceholder } from '../components/HistoricPlaceholder';
import { PlacePhoto } from '../components/PlacePhoto';
import { PlaceBadges, PlaceDetails } from '../components/PlaceDetails';

/** The content with the draft in place of the saved place (or added, for a new one). Nothing is saved. */
export const withDraft = (content: Content, place: Location): Content => ({
  ...content,
  places: content.places.some(p => p.id === place.id) ? content.places.map(p => (p.id === place.id ? place : p)) : [...content.places, place],
});

/**
 * The place's card as visitors will see it, opened, built from the unsaved
 * draft, in any of the app's languages. Nothing is saved: the draft is only
 * put in place of the saved place for the card (and its glossary links and
 * special hours) to read.
 */
export function PlacePreview({ place, content, onClose }: { place: Location; content: Content; onClose: () => void }) {
  const [lang, setLang] = useState<Lang>('en');
  // The language's interface text first (French and Spanish are downloaded on first use), as in the app.
  // Only the latest choice applies.
  const chosen = useRef<Lang>('en');
  const choose = (l: Lang) => {
    chosen.current = l;
    loadDictionary(l).then(() => {
      if (chosen.current === l) setLang(l);
    });
  };
  const { ref: panel, guard } = useDialog<HTMLDivElement>(onClose);
  // The card's text (L(), nameOf(), …) reads the current language. The admin
  // itself is in English and doesn't use it; back to English on closing.
  setCurrentLang(lang);
  useEffect(() => {
    // Again after a render elsewhere set it (and for the card's own later updates, such as the open-now tick).
    setCurrentLang(lang);
    return () => setCurrentLang('en');
  }, [lang]);

  const preview = withDraft(content, place);
  const category = categories.find(c => c.id === place.category);
  const ar = lang === 'ar';
  const photo = photoForPlace(place);
  // The recording is made from the saved description: an edited one isn't recorded yet.
  const saved = content.places.find(p => p.id === place.id);
  const audioNote = !saved
    ? 'The audio guide is recorded once the place is saved.'
    : descriptionOf(saved, lang) !== descriptionOf(place, lang)
      ? 'The description has changed: its audio guide is recorded again after saving, so the old recording isn’t played here.'
      : undefined;

  // On the page's body, outside the editor's form, so no button in the card can submit (save) the draft.
  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-ink/50 overflow-y-auto p-4 sm:p-8" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        data-portal-host
        className="max-w-4xl mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2">
          <p id="preview-title" className="text-sm font-bold text-ink me-auto">
            Preview <span className="font-normal text-stone-500">· not saved; as visitors will see it after saving</span>
          </p>
          <div role="group" aria-label="Language" className="flex gap-1">
            {LANGS.map(l => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                lang={l}
                onClick={() => choose(l)}
                className={`min-h-11 px-3 rounded-lg text-xs font-bold ${lang === l ? 'bg-nile text-white' : 'bg-chalk text-stone-600 hover:bg-sand/40'}`}
              >
                {LANGUAGES[l].native}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-stone-500 hover:bg-chalk">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ContentValue value={preview}>
          {/* The open card from the app's list, in the chosen language and direction. */}
          <div key={lang} dir={LANGUAGES[lang].dir} lang={lang} className={`bg-white rounded-[2rem] overflow-hidden shadow-xl border border-sand/30 text-start ${ar ? 'font-arabic' : 'font-sans'}`}>
            <div className="flex flex-col md:flex-row h-full">
              <div className="md:w-1/3 h-56 md:h-auto overflow-hidden">
                <PlacePhoto
                  photo={photo}
                  alt={photoAltOf(place)}
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="w-full h-full min-h-56"
                  showCredit
                  fallback={<HistoricPlaceholder category={place.category} name={place.nameEn} className="w-full h-full min-h-56" />}
                />
              </div>
              <div className="flex-1 p-8 md:p-10">
                <p className="text-xs font-bold text-gold-ink uppercase tracking-[0.3em] mb-3">{category ? nameOf(category) : ''}</p>
                <h3 className={`text-3xl text-ink leading-tight ${ar ? 'font-arabic font-bold' : 'font-serif'}`} lang={fallbackLang(place, 'name')}>
                  {nameOf(place) || '(no name yet)'}
                </h3>
                <PlaceBadges place={place} />
                <div className="pt-8 mt-8 border-t border-chalk">
                  <PlaceDetails place={place} audioNote={audioNote} />
                </div>
              </div>
            </div>
          </div>
        </ContentValue>
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}
