import { describe, expect, it } from 'vitest';
import { BANNED_OPENINGS, guideBrief, guideKind, openingFor, OPENINGS } from './guide-style';
import { locations, type Location } from '../data/locations';

const p = (nameEn: string, category: Location['category'] = 'monument', nameAr = '', id = 1) => ({ id, nameEn, nameAr, category });

describe('guideKind', () => {
  it('tells mosques, mausoleums and charitable buildings apart', () => {
    expect(guideKind(p('Sultan Hassan Mosque'))).toBe('mosque');
    expect(guideKind(p('Shajar al-Durr Mausoleum'))).toBe('mausoleum');
    expect(guideKind(p('Sabil - Kuttab Mustafa Bak Tabtaby'))).toBe('charity');
    expect(guideKind(p('Qalawun Complex'))).toBe('charity');
  });

  it('knows churches, synagogues, houses, museums, gates and water works', () => {
    expect(guideKind(p('Church of St. George'))).toBe('church');
    expect(guideKind(p('Monastery of Saint Mercurius (Abu Seifein)'))).toBe('church');
    expect(guideKind(p('Ben Ezra Synagogue'))).toBe('synagogue');
    expect(guideKind(p('Sakna Basha House'))).toBe('house');
    expect(guideKind(p('Manial Palace'))).toBe('house');
    expect(guideKind(p('Coptic Museum'))).toBe('museum');
    expect(guideKind(p('Bab Zuweila'))).toBe('gate');
    expect(guideKind(p('Nilometer of Roda'))).toBe('water');
    expect(guideKind(p('Some Old Monument'))).toBe('monument');
  });

  it('reads the Arabic name too', () => {
    expect(guideKind(p('Al-Hakim', 'monument', 'جامع الحاكم'))).toBe('mosque');
    expect(guideKind(p('Fatima', 'monument', 'قبة فاطمة خاتون'))).toBe('mausoleum');
  });

  it('uses the category for cafés, food, crafts, shops and meeting points', () => {
    expect(guideKind(p('El Fishawy Cafe', 'coffee'))).toBe('coffee');
    expect(guideKind(p('Abou Amr Restaurant', 'restaurant'))).toBe('restaurant');
    expect(guideKind(p('Khan el-Khalili', 'workshop'))).toBe('craft');
    expect(guideKind(p('Nourhan Bazaar', 'stationary'))).toBe('shop');
    expect(guideKind(p('Al-Hussein Square', 'meeting'))).toBe('meeting');
  });
});

describe('guideBrief', () => {
  it('differs between a mosque and a mausoleum', () => {
    const mosque = guideBrief(p('Sultan Hassan Mosque'), 'Sultan Hassan Mosque');
    const tomb = guideBrief(p('Shajar al-Durr Mausoleum'), 'Shajar al-Durr Mausoleum');
    expect(mosque).toMatch(/place of prayer/);
    expect(tomb).toMatch(/person buried here/);
    expect(mosque).not.toBe(tomb);
  });

  it('names the place, and bans the stock openings', () => {
    const brief = guideBrief(p('Bab Zuweila'), 'باب زويلة');
    expect(brief).toContain('باب زويلة');
    for (const o of BANNED_OPENINGS) expect(brief).toContain(`"${o}"`);
  });

  it('gives neighbouring places different opening moves', () => {
    expect(openingFor(1)).not.toBe(openingFor(2));
    expect(new Set([1, 2, 3, 4, 5, 6].map(openingFor)).size).toBe(OPENINGS.length);
  });

  it('gives the bundled places a spread of kinds and openings', () => {
    const kinds = new Set(locations.map(guideKind));
    expect(kinds.size).toBeGreaterThanOrEqual(10);
    const briefs = new Set(locations.map(l => guideBrief(l, l.nameEn)));
    expect(briefs.size).toBe(locations.length);
  });
});
