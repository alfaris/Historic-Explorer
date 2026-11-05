// Makes the small (480px wide) copy of each built-in photo, which phones and
// small cards load instead of the full 960px one (see PlacePhoto's srcset).
// fetch-photos.ts makes these too; run this after adding photos another way:
//   npx tsx scripts/photo-variants.ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const SMALL_WIDTH = 480;
const DIR = join(import.meta.dirname, '..', 'public', 'images', 'photos');

export const smallFileName = (file: string) => file.replace(/\.webp$/, `-${SMALL_WIDTH}.webp`);

export async function makeSmallCopy(input: string, output: string) {
  await sharp(input).resize({ width: SMALL_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toFile(output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = readdirSync(DIR).filter(f => f.endsWith('.webp') && !f.endsWith(`-${SMALL_WIDTH}.webp`));
  for (const f of files) await makeSmallCopy(join(DIR, f), join(DIR, smallFileName(f)));
  console.log(`Made ${files.length} small copies in public/images/photos.`);
}
