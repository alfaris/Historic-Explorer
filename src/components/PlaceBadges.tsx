import type { Location } from '../data/locations';
import { BuiltBadge } from './PlaceEra';
import { HoursBadge } from './PlaceHours';
import { PrayerNotice } from './PrayerTimes';

/**
 * Under a place's name: when it was built, open or closed now, and a prayer
 * pause at a mosque. Shown in every row at first paint, so it's kept apart
 * from the card's body (PlaceDetails), which loads when a card opens.
 */
export function PlaceBadges({ place }: { place: Location }) {
  return (
    <>
      <BuiltBadge place={place} className="mt-2" />
      <HoursBadge place={place} className="mt-2" />
      <PrayerNotice place={place} className="mt-1.5" />
    </>
  );
}
