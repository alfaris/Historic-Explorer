// A sample GET /api/v1/content response, as the server makes it, from fixed
// content (scripts/vectors/sample-content.json, frozen from the built-in content)
// with every optional part filled: the apps' decoding tests read it.

import { normalizeContent, usableContent } from '../../src/data/content.js';
import { contentV1 } from '../../api/_lib/content-v1.js';
import sample from './sample-content.json' with { type: 'json' };
import type { VectorSet } from './common.js';

export const contentSampleVectors: VectorSet = {
  name: 'content-v1-sample',
  build: () => {
    const [p1, p2, p3] = sample.places;
    const raw = {
      ...sample,
      places: [
        { ...p1, hours: { days: Array.from({ length: 7 }, () => [{ open: '09:00', close: '17:00' }]) }, era: 'fatimid', builtFrom: 1125, builtTo: 1126,
          tips: { dress: true, shoesOff: true, photos: 'noFlash', wheelchair: 'partial', toilets: false, noteEn: 'Quiet, please', noteAr: 'برجاء الهدوء' } },
        { ...p2, gallery: [{ src: `/api/photo?id=${'b'.repeat(64)}`, width: 1200, height: 800, author: 'Admin', license: 'Own photo', licenseUrl: null, sourceUrl: '', photoAltEn: 'The dome', photoAltAr: 'القبة' }] },
        p3,
      ],
      notices: [{ textEn: 'Closed for works', textAr: 'مغلق للصيانة', placeId: p1.id, from: '2026-12-01', until: '2026-12-10', important: true }],
      specialPeriods: [{ id: 'ramadan-2027', nameEn: 'Ramadan', nameAr: 'رمضان', from: '2027-02-08', to: '2027-03-09',
        places: { [String(p1.id)]: { days: Array.from({ length: 7 }, () => [{ open: '10:00', close: '15:00' }]) }, [String(p2.id)]: { closed: true } } }],
      maxPlaceId: 500,
    };
    return {
      about:
        'A GET /api/v1/content response (contracts/content-v1.schema.json), made by the server\'s own contentV1() from fixed content with every optional part ' +
        'filled (hours, era and years, visitor tips, a gallery photo, a notice, a special period with both kinds of entry, the built-in glossary and help). ' +
        'The apps\' decoding tests read `response`.',
      response: JSON.parse(JSON.stringify(contentV1(usableContent(normalizeContent(raw))!))),
    };
  },
};
