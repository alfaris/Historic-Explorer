// Makes the small (480px wide) and thumbnail (240px) copies of each built-in
// photo, which phones, small cards and list thumbnails load instead of the full
// 960px one (see PlacePhoto's srcset).
// fetch-photos.ts makes these too; run this after adding photos another way:
//   npx tsx scripts/photo-variants.ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const SMALL_WIDTH = 480;
const DIR = join(import.meta.dirname, '..', 'public', 'images', 'photos');

export const THUMB_WIDTH = 240;
export const smallFileName = (file: string) => file.replace(/\.webp$/, `-${SMALL_WIDTH}.webp`);
export const thumbFileName = (file: string) => file.replace(/\.webp$/, `-${THUMB_WIDTH}.webp`);

export async function makeSmallCopy(input: string, output: string, width = SMALL_WIDTH) {
  await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toFile(output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = readdirSync(DIR).filter(f => f.endsWith('.webp') && !new RegExp(`-(${SMALL_WIDTH}|${THUMB_WIDTH})\\.webp$`).test(f));
  for (const f of files) {
    await makeSmallCopy(join(DIR, f), join(DIR, smallFileName(f)));
    await makeSmallCopy(join(DIR, f), join(DIR, thumbFileName(f)), THUMB_WIDTH);
  }
  console.log(`Made ${files.length} small and thumbnail copies in public/images/photos.`);
}
