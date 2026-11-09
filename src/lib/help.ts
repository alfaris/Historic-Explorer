// The Help sheet: emergency numbers, where the visitor is, and phrases to
// show in Arabic. Pure, so it works offline and is tested.

import type { Point } from './geo';

/** Egypt's emergency numbers (free from any phone). */
export const EMERGENCY = [
  { id: 'ambulance', number: '123' },
  { id: 'touristPolice', number: '126' },
  { id: 'police', number: '122' },
  { id: 'fire', number: '180' },
] as const;
export type EmergencyId = (typeof EMERGENCY)[number]['id'];

/** "30.04440, 31.23570": five decimals, about a metre, easy to read out. */
export const positionText = (p: Point) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/** A maps link to the position, to send to someone. */
export const positionLink = (p: Point) => `https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export type Phrase = { id: string; ar: string };

/** Phrases to show someone, in Arabic. "lost" ends with where to go: the route's start. */
export function phrases(startAr?: string): Phrase[] {
  return [
    { id: 'help', ar: 'أحتاج إلى مساعدة، من فضلك.' },
    { id: 'ambulance', ar: 'من فضلك، اتصل بالإسعاف.' },
    { id: 'toilet', ar: 'أين أقرب دورة مياه؟' },
    { id: 'water', ar: 'أين أجد ماءً للشرب؟' },
    { id: 'lost', ar: startAr ? `أنا تائه. من فضلك ساعدني في الوصول إلى: ${startAr}` : 'أنا تائه. من فضلك ساعدني.' },
  ];
}
