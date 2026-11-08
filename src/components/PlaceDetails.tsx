import React from 'react';
import type { Location } from '../data/locations';
import { L, currentLang, descriptionOf, fallbackLang } from '../i18n/lang';
import { AudioGuide } from './AudioGuide';
import { GlossaryText } from './GlossaryText';
import { BuiltBadge } from './PlaceEra';
import { HoursBadge, PlaceHours } from './PlaceHours';
import { PrayerNotice } from './PrayerTimes';
import { SpotIt } from './SpotIt';
import { VisitorTips } from './VisitorTips';

// The parts of a place's card shared by the list, the map and the admin's
// preview, so the preview shows exactly what visitors see.

/** Under the name: when it was built, open or closed now, and a prayer pause at a mosque. */
export function PlaceBadges({ place }: { place: Location }) {
  return (
    <>
      <BuiltBadge place={place} className="mt-2" />
      <HoursBadge place={place} className="mt-2" />
      <PrayerNotice place={place} className="mt-1.5" />
    </>
  );
}

/**
 * The open card's body: the description with its glossary links, the audio
 * guide, hours and fee, visitor tips and Spot it. `audioNote` shows instead of
 * the audio guide (the admin's preview of a description not yet recorded).
 */
export function PlaceDetails({ place, audioNote }: { place: Location; audioNote?: string }) {
  const description = descriptionOf(place);
  return (
    <>
      <div className="mb-8">
        <p className="text-stone-600 text-lg leading-relaxed mb-4 font-serif italic" lang={fallbackLang(place, 'description')}>
          {description ? <GlossaryText text={description} /> : L('No description available for this location at the moment.', 'لا يوجد وصف متاح حالياً لهذا الموقع.')}
        </p>
        {audioNote ? (
          <p className="text-xs text-stone-500 rounded-xl border border-dashed border-sand p-3" lang="en" dir="ltr">{audioNote}</p>
        ) : (
          <AudioGuide locationId={place.id} text={description} langCode={currentLang()} />
        )}
      </div>
      <PlaceHours place={place} />
      <VisitorTips place={place} />
      <SpotIt place={place} className="mt-4" />
    </>
  );
}
