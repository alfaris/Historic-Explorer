// Checks src/data/photos.ts: every photo belongs to a real place or route,
// its file exists, and it carries the credit its license requires.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locations, routes } from './locations';
import { photos } from './photos';
import { isFreeLicense } from './licenses';

const entries = Object.entries(photos);

describe.runIf(entries.length > 0)('photos', () => {
  it.each(entries)('%s is valid', (key, photo) => {
    const [, kind, id] = key.match(/^(place|route)-(.+)$/) ?? [];
    expect(kind, 'key must start with place- or route-').toBeDefined();
    if (kind === 'place') expect(locations.some(l => l.id === Number(id)), `no place with id ${id}`).toBe(true);
    if (kind === 'route') expect(routes.some(r => r.id === id), `no route with id ${id}`).toBe(true);

    expect(existsSync(join('public', photo.src)), `${photo.src} is missing`).toBe(true);
    expect(photo.width).toBeGreaterThan(0);
    expect(photo.height).toBeGreaterThan(0);

    // CC BY and CC BY-SA require naming the author.
    expect(photo.author.trim(), 'author is empty').not.toBe('');
    expect(photo.author, 'author is unknown').not.toMatch(/^unknown/i);
    expect(isFreeLicense(photo.license), `license "${photo.license}" is not on the allowed list`).toBe(true);
    expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
  });
});

describe('small photo copies', () => {
  it('every built-in photo has its 480px copy for srcset', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { photos } = await import('./photos');
    const { smallPhotoSrc } = await import('./photo-resolve');
    for (const photo of Object.values(photos)) {
      const small = smallPhotoSrc(photo.src);
      expect(small, photo.src).not.toBeNull();
      expect(existsSync(join(__dirname, '../../public', small!)), `${small} is missing: run npx tsx scripts/photo-variants.ts`).toBe(true);
    }
  });

  it('uploaded photos have no small copy', async () => {
    const { smallPhotoSrc } = await import('./photo-resolve');
    expect(smallPhotoSrc('/api/photo?id=abc')).toBeNull();
  });
});
