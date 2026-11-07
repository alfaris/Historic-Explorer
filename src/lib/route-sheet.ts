// The printable route sheet: the week's hours in one line, and a schematic
// map of the stops (no tiles, so it prints crisp and works offline). Pure,
// so it's tested.

type Row = { name: string; text: string };

/** "Monday–Thursday 9 am–5 pm · Friday Closed · …": consecutive days with the same hours together. */
export function compactWeek(rows: Row[], sep = ' · '): string {
  const groups: { first: string; last: string; text: string }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.text === r.text) g.last = r.name;
    else groups.push({ first: r.name, last: r.name, text: r.text });
  }
  return groups.map(g => `${g.first === g.last ? g.first : `${g.first}–${g.last}`} ${g.text}`).join(sep);
}

export type SheetPoint = { x: number; y: number };

/**
 * The stops placed in a `width`-wide box, keeping their real shape (longitude
 * scaled by latitude), north up, with `pad` around them. The height follows
 * the shape, between `minH` and `maxH`.
 */
export function sheetMap(stops: { lat: number; lng: number }[], width = 600, pad = 28, minH = 200, maxH = 340): { width: number; height: number; points: SheetPoint[] } {
  if (stops.length === 0) return { width, height: minH, points: [] };
  const k = Math.cos((stops.reduce((s, p) => s + p.lat, 0) / stops.length) * (Math.PI / 180));
  const xs = stops.map(p => p.lng * k);
  const ys = stops.map(p => p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  const height = Math.round(Math.min(maxH, Math.max(minH, ((width - 2 * pad) * spanY) / spanX + 2 * pad)));
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  // Centre the drawing in the box.
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return {
    width,
    height,
    points: stops.map((_, i) => ({ x: Math.round(offX + (xs[i] - minX) * scale), y: Math.round(offY + (maxY - ys[i]) * scale) })),
  };
}

/** The first sentence of a description, at most `max` characters. */
export function oneLine(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const m = t.match(/^.+?[.!?؟。](?=\s|$)/);
  const first = m ? m[0] : t;
  return first.length <= max ? first : `${first.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
