// Downloads freely licensed photos from Wikimedia Commons for the places and
// routes listed in scripts/photo-sources.ts, resizes them to WebP in
// public/images/photos/, and writes src/data/photos.ts with each credit.
//
//   npm run fetch-photos              fetch photos that aren't downloaded yet
//   npm run fetch-photos -- --force   download every photo again
//   npm run fetch-photos -- --only=place-1,route-al-muizz
//
// Only files under CC BY, CC BY-SA, CC0 or public domain are used; anything
// else is skipped and reported. Commit the images and src/data/photos.ts.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { makeSmallCopy, smallFileName, THUMB_WIDTH, thumbFileName } from './photo-variants';
import { photos as existingPhotos, type Photo } from '../src/data/photos.js';
import { photoSources, type PhotoSource } from './photo-sources.js';
import { isFreeLicense } from '../src/data/licenses.js';

const { values: args } = parseArgs({
  options: {
    force: { type: 'boolean', default: false },
    only: { type: 'string' },
  },
});

const OUTPUT_DIR = 'public/images/photos';
const DATA_FILE = 'src/data/photos.ts';
const WIDTH = 960;
const QUALITY = 72;
// Wikimedia asks automated clients to identify themselves.
const USER_AGENT = 'CairoWalksPhotoFetcher/1.0 (https://github.com/alfaris/Historic-Explorer)';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** GET with Wikimedia's etiquette: a User-Agent, one request at a time, and backing off on 429. */
async function wikimediaFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= 4) throw new Error(`${res.status} from ${new URL(url).host} after ${attempt + 1} attempts`);
    const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt;
    console.log(`  ${res.status} from ${new URL(url).host}, waiting ${Math.round(wait / 1000)}s…`);
    await sleep(wait);
  }
}

async function apiQuery(host: string, params: Record<string, string>) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', ...params }).toString();
  const res = await wikimediaFetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} from ${host}`);
  const body = await res.json();
  if (body.error) throw new Error(`${host}: ${body.error.info ?? body.error.code}`);
  await sleep(1000);
  return body.query ?? {};
}

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** Maps Wikipedia article titles to the file name of each article's main free image. */
async function leadImages(titles: string[]) {
  const result = new Map<string, string>();
  for (const batch of chunks([...new Set(titles)], 50)) {
    const q = await apiQuery('en.wikipedia.org', {
      prop: 'pageimages',
      piprop: 'name',
      pilicense: 'free',
      redirects: '1',
      titles: batch.join('|'),
    });
    // Follow normalisation and redirects back to the title we asked for.
    const origin = new Map<string, string>(batch.map(t => [t, t]));
    for (const n of q.normalized ?? []) origin.set(n.to, origin.get(n.from) ?? n.from);
    for (const r of q.redirects ?? []) origin.set(r.to, origin.get(r.from) ?? r.from);
    for (const page of q.pages ?? []) {
      if (page.pageimage) result.set(origin.get(page.title) ?? page.title, page.pageimage);
    }
  }
  return result;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

// Commons often records the uploader's wiki username, e.g. "User:Name" or "Name (talk)".
const cleanAuthor = (author: string) =>
  author.replace(/^User:/i, '').replace(/\s*\((talk|talk page)\)\s*$/i, '').trim();

type FileInfo = { thumbUrl: string; author: string; license: string; licenseUrl: string | null; sourceUrl: string };

/** Looks up Commons files: a thumbnail URL and the license and author to credit. */
async function commonsInfo(files: string[]) {
  const result = new Map<string, FileInfo | { error: string }>();
  for (const batch of chunks([...new Set(files)], 50)) {
    const q = await apiQuery('commons.wikimedia.org', {
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(WIDTH * 2),
      iiextmetadatafilter: 'Artist|Credit|LicenseShortName|LicenseUrl|AttributionRequired',
      titles: batch.map(f => `File:${f}`).join('|'),
    });
    const origin = new Map<string, string>(batch.map(f => [`File:${f}`, f]));
    for (const n of q.normalized ?? []) origin.set(n.to, origin.get(n.from) ?? n.from);
    for (const page of q.pages ?? []) {
      const file = origin.get(page.title) ?? page.title.replace(/^File:/, '');
      const info = page.imageinfo?.[0];
      if (!info) {
        result.set(file, { error: 'not found on Wikimedia Commons' });
        continue;
      }
      const meta = info.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value ?? '');
      if (!isFreeLicense(license)) {
        result.set(file, { error: `license "${license || 'unknown'}" is not on the allowed list` });
        continue;
      }
      const author = cleanAuthor(stripHtml(meta.Artist?.value ?? '') || stripHtml(meta.Credit?.value ?? '')) || 'Unknown author';
      result.set(file, {
        thumbUrl: info.thumburl ?? info.url,
        author: author.length > 80 ? `${author.slice(0, 77)}…` : author,
        license,
        licenseUrl: meta.LicenseUrl?.value || null,
        sourceUrl: info.descriptionurl,
      });
    }
  }
  return result;
}

function writeDataFile(photos: Record<string, Photo>) {
  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  const source = `// Photos of places and routes, with the credit each license requires.
// GENERATED by \`npm run fetch-photos\` from scripts/photo-sources.ts. Don't edit
// by hand: change the sources and run the script again.

export interface Photo {
  /** Path under public/, e.g. /images/photos/place-1.webp */
  src: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string | null;
  /** The file's page on Wikimedia Commons. */
  sourceUrl: string;
}

export const photos: Record<string, Photo> = ${JSON.stringify(sorted, null, 2)};

export const placePhoto = (id: number): Photo | undefined => photos[\`place-\${id}\`];
export const routePhoto = (id: string): Photo | undefined => photos[\`route-\${id}\`];
`;
  writeFileSync(DATA_FILE, source);
}

// --- main ---

const only = args.only ? new Set(args.only.split(',').map(s => s.trim())) : null;
const sources = photoSources.filter(s => !only || only.has(s.key));
const todo = sources.filter(s => args.force || !existingPhotos[s.key] || !existsSync(join('public', existingPhotos[s.key].src)));
console.log(`${sources.length} sources, ${sources.length - todo.length} already downloaded, ${todo.length} to fetch.\n`);

const photos: Record<string, Photo> = { ...existingPhotos };
// Drop entries whose source was removed from the list.
for (const key of Object.keys(photos)) if (!photoSources.some(s => s.key === key)) delete photos[key];

const failures: string[] = [];
const fileFor = new Map<PhotoSource, string>();

const articleSources = todo.filter((s): s is PhotoSource & { wikipedia: string } => 'wikipedia' in s);
const leads = articleSources.length ? await leadImages(articleSources.map(s => s.wikipedia)) : new Map();
for (const s of todo) {
  const file = 'file' in s ? s.file : leads.get(s.wikipedia);
  if (file) fileFor.set(s, file);
  else failures.push(`${s.key}: no free main image found for the article "${'wikipedia' in s ? s.wikipedia : ''}" (check the title, or set a file)`);
}

const infos = fileFor.size ? await commonsInfo([...fileFor.values()]) : new Map();
mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [s, file] of fileFor) {
  const info = infos.get(file);
  if (!info || 'error' in info) {
    failures.push(`${s.key}: File:${file}: ${info?.error ?? 'no information returned'}`);
    continue;
  }
  try {
    const res = await wikimediaFetch(info.thumbUrl);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const input = Buffer.from(await res.arrayBuffer());
    const output = join(OUTPUT_DIR, `${s.key}.webp`);
    const { width, height } = await sharp(input)
      .rotate()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(output);
    await makeSmallCopy(output, join(OUTPUT_DIR, smallFileName(`${s.key}.webp`)));
    await makeSmallCopy(output, join(OUTPUT_DIR, thumbFileName(`${s.key}.webp`)), THUMB_WIDTH);
    photos[s.key] = {
      src: `/images/photos/${s.key}.webp`,
      width,
      height,
      author: info.author,
      license: info.license,
      licenseUrl: info.licenseUrl,
      sourceUrl: info.sourceUrl,
    };
    console.log(`✓ ${s.key}  ${file}  (${info.license}, ${info.author})`);
    await sleep(500);
  } catch (err) {
    failures.push(`${s.key}: File:${file}: ${(err as Error).message}`);
  }
}

writeDataFile(photos);
console.log(`\n${Object.keys(photos).length} photos in ${DATA_FILE}.`);
if (failures.length) {
  console.log(`\n${failures.length} not fetched:`);
  for (const f of failures) console.log(`  ${f}`);
  process.exitCode = 1;
}
