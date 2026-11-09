import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { withNoticesFor, isActive, isExpired, noticeKey, noticeProblems, noticesFor, noticeText, normalizeNotices, type Notice } from './notices';

const route = bundledContent.routes[0];
const place = bundledContent.places.find(p => p.routeId === route.id)!;
const base: Notice = { textEn: 'Bab Zuweila minarets closed.', textAr: 'مآذن باب زويلة مغلقة.' };

describe('notices', () => {
  it('normalizes untrusted input', () => {
    const [n] = normalizeNotices([{ textEn: ' Hi ', textAr: 'مرحبا', textFr: ' ', textEs: 'Hola', from: '2026-11-01', routeId: route.id, placeId: 4, important: 'yes', extra: 1, drafted: ['textEs', 'textFr'] }])!;
    expect(n).toEqual({ textEn: 'Hi', textAr: 'مرحبا', textEs: 'Hola', from: '2026-11-01', routeId: route.id, drafted: ['textEs'] });
    expect(normalizeNotices([])).toBeUndefined();
    expect(normalizeNotices('x')).toBeUndefined();
  });

  it('checks text, dates and where it shows', () => {
    const routes = new Set([route.id]);
    const places = new Set([place.id]);
    expect(noticeProblems([base], routes, places)).toEqual([]);
    const bad = noticeProblems([{ textEn: '', textAr: 'no arabic', from: '2026-02-30', until: 'soon', routeId: 'gone' }, { ...base, from: '2026-11-10', until: '2026-11-01', placeId: 99999 }], routes, places);
    expect(bad).toEqual([
      'Notice 1: English text is empty.',
      'Notice 1: Arabic text is missing.',
      "Notice 1: the first day isn't a date.",
      "Notice 1: the last day isn't a date.",
      'Notice 1: its route no longer exists.',
      'Notice 2 "Bab Zuweila minarets closed.": the last day is before the first.',
      'Notice 2 "Bab Zuweila minarets closed.": its place no longer exists.',
    ]);
    expect(noticeProblems(Array(11).fill(base), routes, places)).toContain('Notices: at most 10.');
  });

  it('shows between the first and last day, inclusive', () => {
    const n = { ...base, from: '2026-11-05', until: '2026-11-07' };
    expect(['2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08'].map(d => isActive(n, d))).toEqual([false, true, true, false]);
    expect(isActive(base, '2030-01-01')).toBe(true);
    expect(isExpired(n, '2026-11-07')).toBe(false);
    expect(isExpired(n, '2026-11-08')).toBe(true);
    expect(isExpired(base, '2030-01-01')).toBe(false);
  });

  it('picks the notices for the app, a route or a place, important first', () => {
    const app = { ...base, textEn: 'App' };
    const onRoute = { ...base, textEn: 'Route', routeId: route.id };
    const onPlace = { ...base, textEn: 'Place', placeId: place.id };
    const urgent = { ...base, textEn: 'Urgent', important: true };
    const later = { ...base, textEn: 'Later', from: '2027-01-01' };
    const all = [app, onRoute, onPlace, urgent, later];
    const names = (list: Notice[]) => list.map(n => n.textEn);
    expect(names(noticesFor(all, '2026-11-09', { app: true }))).toEqual(['Urgent', 'App']);
    expect(names(noticesFor(all, '2026-11-09', { routeId: route.id }))).toEqual(['Route']);
    expect(names(noticesFor(all, '2026-11-09', { placeId: place.id }))).toEqual(['Place']);
    expect(noticesFor(undefined, '2026-11-09', { app: true })).toEqual([]);
  });

  it('gives an edited notice a new dismissal key', () => {
    expect(noticeKey(base)).toBe(noticeKey({ ...base }));
    expect(noticeKey(base)).not.toBe(noticeKey({ ...base, textEn: 'Changed.' }));
    expect(noticeKey(base)).not.toBe(noticeKey({ ...base, until: '2026-12-01' }));
  });

  it('shows the visitor language, or English', () => {
    const n = { ...base, textFr: 'Fermé.' };
    expect(noticeText(n, 'fr')).toEqual({ text: 'Fermé.', lang: undefined });
    expect(noticeText(n, 'es')).toEqual({ text: base.textEn, lang: 'en' });
    expect(noticeText(n, 'ar').text).toBe(base.textAr);
  });

  it('is part of the content, and goes with a deleted route or place', () => {
    const content = { ...structuredClone(bundledContent), notices: [base, { ...base, routeId: route.id }, { ...base, placeId: place.id }] };
    expect(normalizeContent(content).notices).toHaveLength(3);
    expect(validateContent(normalizeContent(content))).toEqual([]);
    const withoutPlace = { ...content, places: content.places.filter(p => p.id !== place.id) };
    expect(normalizeContent(withoutPlace).notices).toEqual([base, { ...base, routeId: route.id }]);
    expect(normalizeContent({ ...content, notices: [{ ...base, placeId: 99999 }] }).notices).toBeUndefined();
  });

  it("drops a deleted place's or route's notices before the save check", () => {
    const content = { ...structuredClone(bundledContent), notices: [base, { ...base, routeId: route.id }, { ...base, placeId: place.id }] };
    const noPlace = withNoticesFor({ ...content, places: content.places.filter(p => p.id !== place.id) });
    expect(noPlace.notices).toEqual([base, { ...base, routeId: route.id }]);
    expect(validateContent(noPlace)).toEqual([]);
    const noRoute = withNoticesFor({ ...content, notices: [{ ...base, routeId: route.id }], routes: content.routes.filter(r => r.id !== route.id) });
    expect('notices' in noRoute).toBe(false);
    expect(withNoticesFor(bundledContent)).toBe(bundledContent);
  });
});

describe('in the admin', () => {
  it('drafts missing French and Spanish, dropping drafts for moved notices', async () => {
    const { missingNoticeText, applyNoticeDrafts } = await import('../admin/NoticesTab');
    const two = [base, { ...base, textEn: 'Market on Friday.' }];
    const sent = missingNoticeText(two, 'fr');
    expect(sent).toEqual({ '0.textFr': base.textEn, '1.textFr': 'Market on Friday.' });
    const texts = { '0.textFr': 'Fermé.', '1.textFr': 'Marché vendredi.' };
    expect(applyNoticeDrafts(two, texts, sent).map(n => [n.textFr, n.drafted])).toEqual([['Fermé.', ['textFr']], ['Marché vendredi.', ['textFr']]]);
    // The first removed while drafting: the market notice is now index 0.
    expect(applyNoticeDrafts([two[1]], texts, sent)[0].textFr).toBeUndefined();
  });

  it('lists notice drafts in the checklist', async () => {
    const { draftsToReview } = await import('../admin/content-health');
    const content = { ...structuredClone(bundledContent), notices: [{ ...base, textFr: 'Fermé.', drafted: ['textFr'] }] };
    expect(draftsToReview(content).filter(r => r.kind === 'notice')).toEqual([{ kind: 'notice', id: '0', name: `Notice 1: ${base.textEn}`, keys: ['textFr'] }]);
  });
});
