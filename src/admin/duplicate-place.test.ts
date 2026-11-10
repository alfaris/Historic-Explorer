import { describe, expect, it } from 'vitest';
import { COPY_OFFSET, duplicatePlace } from './duplicate-place';
import type { Location } from '../data/locations';

const place: Location = {
  id: 7,
  routeId: 'muizz',
  nameEn: 'Fishawy Café',
  nameAr: 'مقهى الفيشاوي',
  nameFr: 'Café Fishawy',
  category: 'coffee',
  descriptionEn: 'An old café.',
  descriptionAr: 'مقهى قديم.',
  lat: 30.047712,
  lng: 31.262301,
  tips: { note: 'Busy at night' } as Location['tips'],
  hours: { days: [] } as unknown as Location['hours'],
  feeEn: 'Free',
  era: 'ottoman' as Location['era'],
  mosque: false,
  image: 'fishawy.jpg',
  photo: { src: 'https://blob/x.jpg', width: 800, height: 600 } as Location['photo'],
  photoAltEn: 'Mirrors on the wall',
  photoAltAr: 'مرايا',
  spotEn: 'Find the brass tray',
  spotAnswerEn: 'By the door',
  spotAnswerAr: 'عند الباب',
  drafted: ['nameFr'],
};

describe('duplicatePlace', () => {
  const copy = duplicatePlace(place, 42);

  it('gets the new ID and "(copy)" on its English and Arabic names', () => {
    expect(copy.id).toBe(42);
    expect(copy.nameEn).toBe('Fishawy Café (copy)');
    expect(copy.nameAr).toBe('مقهى الفيشاوي (نسخة)');
    expect(copy.nameFr).toBe('Café Fishawy');
  });

  it('keeps route, category, text, hours, tips, fee and era', () => {
    for (const key of ['routeId', 'category', 'descriptionEn', 'descriptionAr', 'hours', 'tips', 'feeEn', 'era', 'mosque'] as const) {
      expect(copy[key]).toEqual(place[key]);
    }
  });

  it('leaves out the photo, its descriptions, Spot it and drafts', () => {
    for (const key of ['photo', 'image', 'photoAltEn', 'photoAltAr', 'spotEn', 'spotAnswerEn', 'spotAnswerAr', 'drafted']) {
      expect(copy).not.toHaveProperty(key);
    }
  });

  it('moves the position a few metres', () => {
    expect(copy.lat).toBeCloseTo(place.lat + COPY_OFFSET, 6);
    expect(copy.lng).toBeCloseTo(place.lng + COPY_OFFSET, 6);
    expect(copy.lat).not.toBe(place.lat);
  });

  it('leaves the original untouched and an empty name empty', () => {
    expect(place.photo).toBeDefined();
    expect(place.nameEn).toBe('Fishawy Café');
    expect(duplicatePlace({ ...place, nameAr: '' }, 43).nameAr).toBe('');
  });
});
