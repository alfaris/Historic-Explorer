import React, { lazy } from 'react';
import type { Location } from '../data/locations';
import { L, currentLang, descriptionOf, fallbackLang } from '../i18n/lang';
import { AudioGuide } from './AudioGuide';
import { GlossaryText } from './GlossaryText';
import { PlaceHours } from './PlaceHours';
import { SpotIt } from './SpotIt';
import { summaryOf } from '../lib/spot-it';
import { PhotoTip } from './PhotoTip';
import { VisitorTips } from './VisitorTips';
import { Notices } from './Notices';
import { Nearby } from './Nearby';
import { PlaceNote } from './PlaceNote';
import { LazyBoundary } from './LazyBoundary';

// Only places with extra photos load the gallery.
const PlaceGallery = lazy(() => import('./PlaceGallery'));

// The body of a place's card, shared by the list, the map and the admin's
// preview, so the preview shows exactly what visitors see. Loaded when a card
// first opens (see PlaceDetailsLazy); the badges under the name are in PlaceBadges.

/**
 * The open card's body: the description with its glossary links, the audio
 * guide, hours and fee, visitor tips and Spot it. `audioNote` shows instead of
 * the audio guide (the admin's preview of a description not yet recorded).
 */
export function PlaceDetails({ place, audioNote, onOpenPlace }: { place: Location; audioNote?: string; /** Opens another place's card (Nearby); without it, Nearby isn't shown. */ onOpenPlace?: (id: number) => void }) {
  const description = descriptionOf(place);
  const summary = summaryOf(place, currentLang());
  return (
    <>
      <Notices scope={{ placeId: place.id }} className="mb-6" />
      <div className="mb-8">
        {summary && <p className="text-ink text-base font-bold leading-snug mb-3" lang={summary.lang}>{summary.text}</p>}
        <p className="text-stone-600 text-lg leading-relaxed mb-4 font-serif italic" lang={fallbackLang(place, 'description')}>
          {description ? <GlossaryText text={description} /> : L('No description available for this location at the moment.', 'لا يوجد وصف متاح حالياً لهذا الموقع.')}
        </p>
        {audioNote ? (
          <p className="text-xs text-stone-500 rounded-xl border border-dashed border-sand p-3" lang="en" dir="ltr">{audioNote}</p>
        ) : (
          <AudioGuide locationId={place.id} text={description} langCode={currentLang()} />
        )}
      </div>
      {place.gallery?.length ? (
        <LazyBoundary loading={null} failed={null}>
          <PlaceGallery place={place} />
        </LazyBoundary>
      ) : null}
      <PlaceHours place={place} />
      <VisitorTips place={place} />
      <SpotIt place={place} className="mt-4" />
      <PhotoTip place={place} className="mt-4" />
      {onOpenPlace && <PlaceNote placeId={place.id} />}
      {onOpenPlace && <Nearby place={place} onOpen={onOpenPlace} className="mt-4" />}
    </>
  );
}

export default PlaceDetails;
