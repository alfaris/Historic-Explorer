import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent } from '../data/content';
import { normalizeGlossary } from './glossary';
import { normalizePeriods } from './special-hours';
import { draftedOf, normalizeDrafted, withDrafted, withoutDrafted } from './drafted';

describe('draft marks', () => {
  it('adds and removes marks, leaving the item alone when nothing changes', () => {
    const item = { nameFr: 'Mosquée', descriptionFr: 'Une mosquée.' };
    const marked = withDrafted(item, ['nameFr', 'descriptionFr']);
    expect(draftedOf(marked)).toEqual(['nameFr', 'descriptionFr']);
    expect(withDrafted(marked, ['nameFr'])).toBe(marked);
    const one = withoutDrafted(marked, ['nameFr']);
    expect(draftedOf(one)).toEqual(['descriptionFr']);
    const none = withoutDrafted(one, ['descriptionFr']);
    expect('drafted' in none).toBe(false);
    expect(withoutDrafted(item, ['nameFr'])).toBe(item);
  });
  it('keeps only well-formed marks of fields that still have text', () => {
    expect(normalizeDrafted({ nameFr: 'x', descriptionFr: '', highlightsEs: ['a'], drafted: ['nameFr', 'descriptionFr', 'highlightsEs', 'nameFr', 'bad key', 3, 'drafted'] })).toEqual({ drafted: ['nameFr', 'highlightsEs'] });
    expect(normalizeDrafted({ drafted: 'nameFr' })).toEqual({});
  });
});

describe('saved with the content', () => {
  it('on places, routes, glossary terms and special hours', () => {
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { nameFr: 'Nom', drafted: ['nameFr', 'nameEs'] });
    Object.assign(content.routes[0], { nameEs: 'Ruta', drafted: ['nameEs'] });
    const n = normalizeContent(content);
    expect(n.places[0].drafted).toEqual(['nameFr']);
    expect(n.routes[0].drafted).toEqual(['nameEs']);
    expect(normalizeGlossary([{ id: 'iwan', termEn: 'Iwan', termAr: 'إيوان', defEn: 'A hall.', defAr: 'قاعة.', defFr: 'Une salle.', match: [], drafted: ['defFr'] }])![0].drafted).toEqual(['defFr']);
    expect(normalizePeriods([{ id: 'r', nameEn: 'Ramadan', nameAr: 'رمضان', nameEs: 'Ramadán', from: '2027-02-08', to: '2027-03-09', places: {}, drafted: ['nameEs'] }])![0].drafted).toEqual(['nameEs']);
  });
});

describe('in the admin', () => {
  it('Gemini drafts are marked; typing in a field clears its mark', async () => {
    const { fillEmpty, withOptional } = await import('../admin/translations');
    const place = { ...bundledContent.places[0], nameFr: 'Déjà écrit' };
    const filled = fillEmpty(place, { nameFr: 'Brouillon', descriptionFr: 'Une description.' }, ['nameFr', 'descriptionFr']);
    // Only the field that was empty is filled, and marked.
    expect(filled.nameFr).toBe('Déjà écrit');
    expect(draftedOf(filled)).toEqual(['descriptionFr']);
    expect(draftedOf(withOptional(filled, 'descriptionFr', 'Corrigée.'))).toEqual([]);
  });
  it('the checklist lists drafts by item and language', async () => {
    const { draftsToReview, draftSection } = await import('../admin/content-health');
    const content = structuredClone(bundledContent);
    Object.assign(content.places[0], { nameFr: 'Nom', photoAltEn: 'A dome.', drafted: ['nameFr', 'photoAltEn'] });
    Object.assign(content.routes[1], { nameEs: 'Ruta', drafted: ['nameEs'] });
    expect(draftsToReview(content).map(r => [r.kind, r.keys])).toEqual([['place', ['nameFr', 'photoAltEn']], ['route', ['nameEs']]]);
    expect(draftsToReview(content, 'es').map(r => r.id)).toEqual([content.routes[1].id]);
    expect(draftSection('photoAltEn')).toBe('photo');
    expect(draftSection('descriptionEs')).toBe('lang-es');
  });
});
