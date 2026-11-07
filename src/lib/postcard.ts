// The finish screen's walk postcard: a square image drawn on the device
// (canvas), so nothing is uploaded and it works offline. The layout helpers
// are pure and tested; drawing needs a browser.

export const POSTCARD_SIZE = 1080;

/** `text` broken into lines no wider than `max` (by `measure`), at most `maxLines`, the last ending in "…" if cut. */
export function wrapLines(text: string, max: number, measure: (s: string) => number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`) > max) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** The part of a `w`×`h` image that covers a `boxW`×`boxH` box (centred, like object-fit: cover). */
export function coverCrop(w: number, h: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / w, boxH / h);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return { sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh };
}

export interface PostcardText {
  title: string;
  route: string;
  /** e.g. "20/20 stops · ≈ 4.2 km · ≈ 55 min" */
  stats: string;
  brand: string;
  rtl: boolean;
  /** Font families for the title and the rest (already loaded). */
  serif: string;
  sans: string;
  /** The photo's credit, printed on the card (its license requires it), e.g. "Photo: Sailko · CC BY 3.0 · creativecommons.org/licenses/by/3.0". */
  credit?: string;
}

/** The credit line a photo's license asks for, to print on the card. */
export const photoCredit = (photo: { author: string; license: string; licenseUrl: string | null }, label: string) =>
  [`${label}: ${photo.author}`, photo.license, photo.licenseUrl?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ');

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo'));
    img.src = src;
  });

/** Draws the postcard and returns it as a JPEG. Without a photo (or if it fails), a plain green card. */
export async function makePostcard(text: PostcardText, photoSrc?: string): Promise<Blob> {
  const S = POSTCARD_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  // Background: the photo across the top, the app's green below.
  ctx.fillStyle = '#1a4d3b';
  ctx.fillRect(0, 0, S, S);
  const photoH = Math.round(S * 0.58);
  let photoDrawn = false;
  if (photoSrc) {
    try {
      const img = await loadImage(photoSrc);
      const c = coverCrop(img.naturalWidth, img.naturalHeight, S, photoH);
      ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, S, photoH);
      photoDrawn = true;
      const fade = ctx.createLinearGradient(0, photoH * 0.55, 0, photoH);
      fade.addColorStop(0, 'rgba(26,77,59,0)');
      fade.addColorStop(1, 'rgba(26,77,59,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, S, photoH);
    } catch {
      // A plain card is still a card.
    }
  }

  const pad = 80;
  const x = text.rtl ? S - pad : pad;
  ctx.direction = text.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // Gold rule and title.
  ctx.fillStyle = '#c5a059';
  ctx.fillRect(text.rtl ? S - pad - 120 : pad, photoH + 30, 120, 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${text.rtl ? 64 : 76}px ${text.rtl ? text.sans : text.serif}`;
  let y = photoH + 130;
  for (const line of wrapLines(text.title, S - 2 * pad, s => ctx.measureText(s).width, 1)) {
    ctx.fillText(line, x, y);
    y += 84;
  }
  ctx.font = `600 46px ${text.sans}`;
  ctx.fillStyle = '#f1e7d3';
  for (const line of wrapLines(text.route, S - 2 * pad, s => ctx.measureText(s).width, 2)) {
    ctx.fillText(line, x, y);
    y += 58;
  }
  ctx.font = `500 36px ${text.sans}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text.stats, x, Math.min(y + 20, S - 130));

  // Brand at the foot, and the photo's credit under it (only when the photo is on the card).
  ctx.font = `700 30px ${text.sans}`;
  ctx.fillStyle = '#c5a059';
  ctx.fillText(text.brand, x, S - pad + 10);
  if (text.credit && photoDrawn) {
    ctx.font = `400 20px ${text.sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const line = wrapLines(text.credit, S - 2 * pad, s => ctx.measureText(s).width, 1)[0];
    ctx.fillText(line, x, S - 36);
  }

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.88));
}
