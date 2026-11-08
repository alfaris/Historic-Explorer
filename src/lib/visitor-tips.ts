// Practical tips for visiting a place: dress, shoes, photos, access, toilets
// and an optional note. The fixed items are worded here in every language, so
// the admin only picks them. Pure; shared by the app, the admin and the server.

import { LANGS, LANGUAGES, type Lang } from '../i18n/lang.js';
import { isActiveMosque } from './prayer-times.js';
import type { Location } from '../data/locations.js';

export type PhotoRule = 'yes' | 'no' | 'noFlash' | 'fee';
export type Access = 'yes' | 'partial' | 'no';

export interface VisitorTips {
  /** Modest dress: shoulders and knees covered, headscarves for women. */
  dress?: boolean;
  shoesOff?: boolean;
  photos?: PhotoRule;
  wheelchair?: Access;
  toilets?: boolean;
  noteEn?: string;
  noteAr?: string;
  noteFr?: string;
  noteEs?: string;
}

const PHOTO_RULES: PhotoRule[] = ['yes', 'no', 'noFlash', 'fee'];
const ACCESS: Access[] = ['yes', 'partial', 'no'];
const NOTE_MAX = 200;

/** Tips from untrusted input, keeping only well-formed parts; undefined when there are none. */
export function normalizeTips(input: unknown): VisitorTips | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const tips: VisitorTips = {
    ...(typeof raw.dress === 'boolean' ? { dress: raw.dress } : {}),
    ...(typeof raw.shoesOff === 'boolean' ? { shoesOff: raw.shoesOff } : {}),
    ...(PHOTO_RULES.includes(raw.photos as PhotoRule) ? { photos: raw.photos as PhotoRule } : {}),
    ...(ACCESS.includes(raw.wheelchair as Access) ? { wheelchair: raw.wheelchair as Access } : {}),
    ...(typeof raw.toilets === 'boolean' ? { toilets: raw.toilets } : {}),
    ...Object.fromEntries(LANGS.map(l => `note${LANGUAGES[l].suffix}`).filter(k => str(raw[k])).map(k => [k, str(raw[k])])),
  };
  return Object.keys(tips).length ? tips : undefined;
}

export function tipsProblems(tips: VisitorTips): string[] {
  return LANGS.map(l => `note${LANGUAGES[l].suffix}` as const)
    .filter(k => (tips[k] ?? '').length > NOTE_MAX)
    .map(k => `visitor tips ${k} is longer than ${NOTE_MAX} characters.`);
}

/** The tips to show: the admin's, else for an active mosque modest dress and shoes off. */
export function effectiveTips(place: Pick<Location, 'nameEn' | 'nameAr' | 'mosque' | 'tips'>): VisitorTips | undefined {
  if (place.tips) return place.tips;
  return isActiveMosque(place) ? { dress: true, shoesOff: true } : undefined;
}

export type TipIcon = 'dress' | 'shoes' | 'camera' | 'cameraOff' | 'access' | 'toilet' | 'note';
export type TipLine = { icon: TipIcon; text: string; lang?: 'en' };

const T: Record<string, Record<Lang, string>> = {
  dress: {
    en: 'Modest dress: shoulders and knees covered; women cover their hair',
    ar: 'ملابس محتشمة: تغطية الكتفين والركبتين، وتغطي النساء شعرهن',
    fr: 'Tenue correcte : épaules et genoux couverts ; les femmes se couvrent les cheveux',
    es: 'Ropa discreta: hombros y rodillas cubiertos; las mujeres se cubren el pelo',
  },
  shoesOff: { en: 'Shoes off inside', ar: 'اخلع حذاءك في الداخل', fr: 'Chaussures retirées à l’intérieur', es: 'Descálzate en el interior' },
  'photos.yes': { en: 'Photos allowed', ar: 'التصوير مسموح', fr: 'Photos autorisées', es: 'Se permiten fotos' },
  'photos.no': { en: 'No photos', ar: 'التصوير ممنوع', fr: 'Photos interdites', es: 'No se permiten fotos' },
  'photos.noFlash': { en: 'Photos allowed, no flash', ar: 'التصوير مسموح بدون فلاش', fr: 'Photos autorisées, sans flash', es: 'Fotos permitidas, sin flash' },
  'photos.fee': { en: 'Photos for a fee', ar: 'التصوير برسوم', fr: 'Photos payantes', es: 'Fotos con pago' },
  'wheelchair.yes': { en: 'Step-free access', ar: 'دخول بدون درجات', fr: 'Accès de plain-pied', es: 'Acceso sin escalones' },
  'wheelchair.partial': { en: 'Partly step-free', ar: 'دخول بدون درجات جزئيًا', fr: 'Accès partiellement de plain-pied', es: 'Acceso parcialmente sin escalones' },
  'wheelchair.no': { en: 'Not step-free', ar: 'لا يوجد دخول بدون درجات', fr: 'Pas d’accès de plain-pied', es: 'Sin acceso sin escalones' },
  toilets: { en: 'Toilets on site', ar: 'توجد دورات مياه', fr: 'Toilettes sur place', es: 'Aseos en el lugar' },
};

/** "Step-free access", "Partly step-free" or "Not step-free", in the given language. */
export const accessText = (access: Access, lang: Lang) => T[`wheelchair.${access}`][lang];

/** The tips as lines to show, in order, in the given language. */
export function tipLines(tips: VisitorTips, lang: Lang): TipLine[] {
  const lines: TipLine[] = [];
  if (tips.dress) lines.push({ icon: 'dress', text: T.dress[lang] });
  if (tips.shoesOff) lines.push({ icon: 'shoes', text: T.shoesOff[lang] });
  if (tips.photos) lines.push({ icon: tips.photos === 'no' ? 'cameraOff' : 'camera', text: T[`photos.${tips.photos}`][lang] });
  if (tips.wheelchair) lines.push({ icon: 'access', text: accessText(tips.wheelchair, lang) });
  if (tips.toilets) lines.push({ icon: 'toilet', text: T.toilets[lang] });
  const own = tips[`note${LANGUAGES[lang].suffix}`];
  if (own) lines.push({ icon: 'note', text: own });
  else if (tips.noteEn) lines.push({ icon: 'note', text: tips.noteEn, lang: lang === 'en' ? undefined : 'en' });
  return lines;
}
