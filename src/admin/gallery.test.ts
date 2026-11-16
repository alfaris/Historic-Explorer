import { describe, expect, it } from 'vitest';
import { bundledContent, MAX_GALLERY, normalizeContent, validateContent } from '../data/content';
import type { GalleryPhoto } from '../data/locations';
import { addToGallery, fillGalleryAlts, moveInGallery, removeFromGallery, updateInGallery } from './gallery';
import { duplicatePlace } from './duplicate-place';
import { routePack } from '../lib/offline-pack';

const photo = (n: number): GalleryPhoto => ({ src: `/api/photo?id=${String(n).repeat(64).slice(0, 64)}`, width: 960, height: 720, author: 'A', license: 'Own photo', licenseUrl: null, sourceUrl: '' });

describe('gallery editing', () => {
  it('adds up to the limit, without the same photo twice', () => {
    let g: GalleryPhoto[] = [];
    for (let i = 1; i <= MAX_GALLERY + 1; i++) g = addToGallery(g, photo(i));
    expect(g).toHaveLength(MAX_GALLERY);
    expect(addToGallery([photo(1)], photo(1))).toHaveLength(1);
  });

  it('moves, removes and updates photos, dropping empty descriptions', () => {
    const g = [photo(1), photo(2), photo(3)];
    expect(moveInGallery(g, 0, 1).map(p => p.src)).toEqual([photo(2), photo(1), photo(3)].map(p => p.src));
    expect(moveInGallery(g, 0, -1)).toBe(g);
    expect(removeFromGallery(g, 1).map(p => p.src)).toEqual([photo(1), photo(3)].map(p => p.src));
    const updated = updateInGallery([{ ...photo(1), photoAltEn: 'x' }], 0, { photoAltEn: ' ', author: 'B' });
    expect(updated[0]).toEqual({ ...photo(1), author: 'B' });
  });

  it("fills Gemini's descriptions into the right photo, even after it moved, and only empty ones", () => {
    const g = [photo(1), { ...photo(2), photoAltAr: 'كتبتها' }];
    const moved = moveInGallery(g, 1, -1);
    const filled = fillGalleryAlts(moved, 1, photo(2).src, { photoAltEn: 'A courtyard', photoAltAr: 'فناء' });
    expect(filled[0]).toMatchObject({ photoAltEn: 'A courtyard', photoAltAr: 'كتبتها' });
    expect(fillGalleryAlts(removeFromGallery(g, 1), 1, photo(2).src, { photoAltEn: 'x' })).toHaveLength(1);
  });
});

describe('content', () => {
  it('keeps extra photos with their descriptions and checks them', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { gallery: [{ ...photo(1), photoAltEn: '  A door. ', photoAltFr: '' }, { src: '' }, 'x'] });
    const n = normalizeContent(content);
    expect(n.places[0].gallery).toEqual([{ ...photo(1), photoAltEn: 'A door.' }]);
    expect(validateContent(n)).toEqual([]);
    n.places[0].gallery = [photo(1), photo(1)];
    expect(validateContent(n).join(' ')).toContain('the same photo is in More photos twice');
    n.places[0].gallery = [1, 2, 3, 4, 5].map(photo);
    expect(validateContent(n).join(' ')).toContain(`at most ${MAX_GALLERY} more photos`);
    n.places[0].gallery = [{ ...photo(1), src: '/images/photos/x.webp' }];
    expect(validateContent(n).join(' ')).toContain('must be an uploaded photo');
    n.places[0].gallery = [{ ...photo(1), author: '' }];
    expect(validateContent(n).join(' ')).toContain('more photos 1: photo credit');
  });

  it("aren't copied to a duplicate place, and go into a route's offline download", () => {
    const place = { ...bundledContent.places[0], gallery: [photo(1)] };
    expect('gallery' in duplicatePlace(place, 999)).toBe(false);
    const route = bundledContent.routes.find(r => r.id === place.routeId)!;
    const urls = routePack(route, [place], 'en').map(f => f.url);
    expect(urls).toContain(photo(1).src);
  });
});
