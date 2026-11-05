// A route's length and walking time are stored as numbers (distanceKm,
// hoursMin, hoursMax) and written out in the visitor's language. Older content
// had free text ("2.5 km", "2-3 hours"); it is read here, and the English text
// is still stored alongside the numbers for app versions that read it.
//
// Shared by the browser, the API functions and the tests.

export type FormatLang = 'en' | 'ar' | 'fr';

const num = (s: string) => Number(s.replace(',', '.'));

/** Kilometres from old text such as "2.5 km" or "800 m"; NaN if unreadable. */
export function parseDistanceKm(text: string): number {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(km|m)?\b/i.exec(text);
  if (!m) return NaN;
  return m[2]?.toLowerCase() === 'm' ? num(m[1]) / 1000 : num(m[1]);
}

/** [min, max] hours from old text such as "2-3 hours", "1.5–2 hours", "3 hours" or "45 min"; null if unreadable. */
export function parseHours(text: string): [number, number] | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:[-–—]|to)?\s*(\d+(?:[.,]\d+)?)?\s*(hours?|hrs?|h|min(?:utes?)?)?\b/i.exec(text);
  if (!m) return null;
  const scale = m[3]?.toLowerCase().startsWith('min') ? 1 / 60 : 1;
  const a = num(m[1]) * scale;
  const b = m[2] ? num(m[2]) * scale : a;
  return [a, b];
}

// Up to one decimal place, without a trailing ".0". French uses a decimal comma.
const decimal = (n: number, lang: FormatLang) => {
  const s = String(Math.round(n * 10) / 10);
  return lang === 'fr' ? s.replace('.', ',') : s;
};

export function formatDistance(km: number, lang: FormatLang): string {
  return lang === 'ar' ? `${decimal(km, lang)} كم` : `${decimal(km, lang)} km`;
}

export function formatDuration(min: number, max: number, lang: FormatLang): string {
  const a = decimal(min, lang);
  const b = decimal(max, lang);
  const single = a === b;
  if (lang === 'fr') {
    const unit = max < 2 ? 'heure' : 'heures';
    return single ? `${a} ${unit}` : `${a} à ${b} ${unit}`;
  }
  if (lang === 'ar') {
    if (single && max === 1) return 'ساعة واحدة';
    if (single && max === 2) return 'ساعتان';
    // ساعات after whole numbers from 3 to 10; ساعة otherwise (e.g. 1.5, 11).
    const unit = Number.isInteger(max) && max >= 3 && max <= 10 ? 'ساعات' : 'ساعة';
    return single ? `${b} ${unit}` : `${a}–${b} ${unit}`;
  }
  const unit = single && max === 1 ? 'hour' : 'hours';
  return single ? `${a} ${unit}` : `${a}-${b} ${unit}`;
}

/** The English text stored next to the numbers, for app versions that read it. */
export const routeText = (r: { distanceKm: number; hoursMin: number; hoursMax: number }) => ({
  distance: Number.isFinite(r.distanceKm) && r.distanceKm > 0 ? formatDistance(r.distanceKm, 'en') : '',
  duration: Number.isFinite(r.hoursMin) && Number.isFinite(r.hoursMax) && r.hoursMin > 0 ? formatDuration(r.hoursMin, r.hoursMax, 'en') : '',
});
