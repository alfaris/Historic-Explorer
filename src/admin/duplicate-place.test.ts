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
  descriptionFr: 'Un vieux café (brouillon).',
  drafted: ['descriptionFr', 'nameAr'],
};

describe('duplicatePlace', () => {
  const copy = duplicatePlace(place, 42);

  it('gets the new ID and "(copy)" on its English and Arabic names', () => {
    expect(copy.id).toBe(42);
    expect(copy.nameEn).toBe('Fishawy Café (copy)');
    expect(copy.nameAr).toBe('مقهى الفيشاوي (نسخة)');
    expect(copy.nameFr).toBe('Café Fishawy');
  });

  it('leaves out unchecked drafted text, keeping a required field still marked for review', () => {
    expect(copy).not.toHaveProperty('descriptionFr');
    expect(copy.drafted).toEqual(['nameAr']);
    const plain = duplicatePlace({ ...place, drafted: ['descriptionFr'] }, 44);
    expect(plain).not.toHaveProperty('descriptionFr');
    expect(plain).not.toHaveProperty('drafted');
  });

  it('keeps route, category, text, hours, tips, fee and era', () => {
    for (const key of ['routeId', 'category', 'descriptionEn', 'descriptionAr', 'hours', 'tips', 'feeEn', 'era', 'mosque'] as const) {
      expect(copy[key]).toEqual(place[key]);
    }
  });

  it('leaves out the photo, its descriptions, Spot it and drafts', () => {
    for (const key of ['photo', 'image', 'photoAltEn', 'photoAltAr', 'spotEn', 'spotAnswerEn', 'spotAnswerAr']) {
      expect(copy).not.toHaveProperty(key);
    }
  });

  it('moves the position a few metres', () => {
    expect(copy.lat).toBeCloseTo(place.lat + COPY_OFFSET, 6);
    expect(copy.lng).toBeCloseTo(place.lng + COPY_OFFSET, 6);
    expect(copy.lat).not.toBe(place.lat);
  });

  it("moves further when an earlier copy is already there", () => {
    const first = duplicatePlace(place, 42, [place]);
    const second = duplicatePlace(place, 43, [place, first]);
    expect(second.lat).toBeCloseTo(place.lat + 2 * COPY_OFFSET, 6);
    expect(`${second.lat},${second.lng}`).not.toBe(`${first.lat},${first.lng}`);
    const third = duplicatePlace(place, 44, [place, first, second]);
    expect(third.lng).toBeCloseTo(place.lng + 3 * COPY_OFFSET, 6);
  });

  it('leaves the original untouched and an empty name empty', () => {
    expect(place.photo).toBeDefined();
    expect(place.nameEn).toBe('Fishawy Café');
    expect(duplicatePlace({ ...place, nameAr: '' }, 43).nameAr).toBe('');
  });
});
