// "Share my passport": a square image of the stamps, drawn on the device
// (canvas), so nothing is uploaded and it works offline. The layout is pure
// and tested; drawing needs a browser.

import { POSTCARD_SIZE, wrapLines } from './postcard';

export type StampSpot = { x: number; y: number; r: number };

/** Centres for `n` stamps in rows of three (the last row centred), in a `size` square below a `top` margin. */
export function stampGrid(n: number, size = POSTCARD_SIZE, top = 300, bottom = 140): StampSpot[] {
  const perRow = 3;
  const rows = Math.max(1, Math.ceil(n / perRow));
  const cellW = size / perRow;
  const cellH = (size - top - bottom) / rows;
  const r = Math.floor(Math.min(cellW, cellH) * 0.42);
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - row * perRow);
    const col = i % perRow;
    const x = size / 2 + (col - (inRow - 1) / 2) * cellW;
    const y = top + cellH * (row + 0.5);
    return { x: Math.round(x), y: Math.round(y), r };
  });
}

export interface PassportImage {
  title: string;
  /** "2 of 5 walks" */
  count: string;
  stamps: { name: string; date: string | null }[];
  brand: string;
  rtl: boolean;
  serif: string;
  sans: string;
}

/** Draws the passport and returns it as a PNG. */
export async function makePassportImage(p: PassportImage): Promise<Blob> {
  const S = POSTCARD_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#1a4d3b';
  ctx.fillRect(0, 0, S, S);
  ctx.direction = p.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${p.rtl ? 68 : 80}px ${p.rtl ? p.sans : p.serif}`;
  ctx.fillText(p.title, S / 2, 150);
  ctx.fillStyle = '#c5a059';
  ctx.font = `600 40px ${p.sans}`;
  ctx.fillText(p.count, S / 2, 215);

  stampGrid(p.stamps.length, S).forEach((spot, i) => {
    const { name, date } = p.stamps[i];
    const got = date !== null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fillStyle = got ? '#f1e7d3' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.setLineDash(got ? [] : [14, 12]);
    ctx.strokeStyle = got ? '#c5a059' : 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = got ? '#1a4d3b' : 'rgba(255,255,255,0.55)';
    ctx.font = `700 30px ${p.sans}`;
    const lines = wrapLines(name, spot.r * 1.6, s => ctx.measureText(s).width, 3);
    let y = spot.y - (lines.length - 1) * 18 - (got ? 14 : 0);
    for (const line of lines) {
      ctx.fillText(line, spot.x, y);
      y += 36;
    }
    if (got) {
      ctx.font = `500 24px ${p.sans}`;
      ctx.fillStyle = '#8a6d2f';
      ctx.fillText(date!, spot.x, y + 6);
    }
  });

  ctx.font = `700 30px ${p.sans}`;
  ctx.fillStyle = '#c5a059';
  ctx.fillText(p.brand, S / 2, S - 70);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
