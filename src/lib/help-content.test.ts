import { describe, expect, it } from 'vitest';
import { bundledContent, normalizeContent, validateContent } from '../data/content';
import { helpProblems, isPhone, normalizeHelp, telHref } from './help-content';

const help = {
  contacts: [{ nameEn: ' Your guide, Ahmed ', nameAr: 'المرشد أحمد', nameFr: '', phone: '+20 100 123 4567' }],
  tips: [{ textEn: 'Al-Muizz is closed to cars on Fridays.', textAr: 'شارع المعز مغلق أمام السيارات يوم الجمعة.' }],
  phrases: [{ ar: 'أين محطة المترو؟', meaningEn: 'Where is the metro station?', meaningEs: '¿Dónde está el metro?' }],
};

describe('normalizeHelp', () => {
  it('keeps the known fields, trimmed, and drops empty optional ones', () => {
    const n = normalizeHelp(help)!;
    expect(n.contacts[0]).toEqual({ nameEn: 'Your guide, Ahmed', nameAr: 'المرشد أحمد', phone: '+20 100 123 4567' });
    expect(n.phrases[0].meaningEs).toBe('¿Dónde está el metro?');
    expect(normalizeHelp({ contacts: [], tips: [], phrases: [] })).toBeUndefined();
    expect(normalizeHelp('x')).toBeUndefined();
  });
  it('is saved with the content and checked', () => {
    const content = normalizeContent({ ...structuredClone(bundledContent), help });
    expect(content.help?.tips).toHaveLength(1);
    expect(validateContent(content)).toEqual([]);
    expect(validateContent({ ...content, help: { ...content.help!, contacts: [{ nameEn: 'Hotel', nameAr: '', phone: 'call me' }] } }).join(' ')).toContain('Arabic name is missing');
  });
});

describe('helpProblems', () => {
  it('checks names, phones, Arabic, lengths and how many', () => {
    const p = helpProblems({
      contacts: Array.from({ length: 6 }, () => ({ nameEn: 'A', nameAr: 'أ', phone: '12' })),
      tips: [{ textEn: '', textAr: 'نص' }],
      phrases: [{ ar: 'not arabic', meaningEn: 'x'.repeat(151) }],
    }).join(' | ');
    expect(p).toContain('at most 5 contacts');
    expect(p).toContain('phone number should be digits');
    expect(p).toContain('Help tip 1: English text is empty');
    expect(p).toContain('the Arabic phrase is missing');
    expect(p).toContain('meaningEn is longer than 150');
  });
  it('calls the digits of a number as written', () => {
    expect(isPhone('+20 (100) 123-4567')).toBe(true);
    expect(isPhone('12')).toBe(false);
    expect(isPhone('call me')).toBe(false);
    expect(telHref('+20 (100) 123-4567')).toBe('tel:+201001234567');
  });
});

describe('in the admin', () => {
  it('drafts missing French and Spanish, marked for review', async () => {
    const { missingHelpText, applyHelpDrafts } = await import('../admin/HelpTab');
    const n = normalizeHelp(help)!;
    expect(missingHelpText(n, 'fr')).toEqual({ 'contacts.0.nameFr': 'Your guide, Ahmed', 'tips.0.textFr': 'Al-Muizz is closed to cars on Fridays.', 'phrases.0.meaningFr': 'Where is the metro station?' });
    expect(Object.keys(missingHelpText(n, 'es'))).toEqual(['contacts.0.nameEs', 'tips.0.textEs']);
    const drafted = applyHelpDrafts(n, { 'contacts.0.nameFr': 'Votre guide, Ahmed', 'tips.9.textFr': 'ignored' });
    expect(drafted.contacts[0]).toMatchObject({ nameFr: 'Votre guide, Ahmed', drafted: ['nameFr'] });
    expect(n.contacts[0].nameFr).toBeUndefined();
  });
  it('drops a draft whose item was removed or changed while it was being made', async () => {
    const { missingHelpText, applyHelpDrafts } = await import('../admin/HelpTab');
    const two = normalizeHelp({ ...help, contacts: [{ nameEn: 'Guide', nameAr: 'المرشد', phone: '+20 100 123 4567' }, { nameEn: 'Hotel', nameAr: 'الفندق', phone: '+20 2 1234 5678' }] })!;
    const sent = missingHelpText(two, 'fr');
    const texts = { 'contacts.0.nameFr': 'Guide (fr)', 'contacts.1.nameFr': 'Hôtel', 'tips.0.textFr': 'Conseil' };
    // The first contact removed while Gemini was drafting: the hotel is now contacts.0.
    const removed = { ...two, contacts: [two.contacts[1]], tips: [{ ...two.tips[0], textEn: 'Edited.' }] };
    const filled = applyHelpDrafts(removed, texts, sent);
    expect(filled.contacts[0].nameFr).toBeUndefined();
    expect(filled.tips[0].textFr).toBeUndefined();
    expect(filled.phrases[0].meaningFr).toBeUndefined();
    expect(applyHelpDrafts(two, texts, sent).contacts.map(c => c.nameFr)).toEqual(['Guide (fr)', 'Hôtel']);
  });
  it('lists Help drafts in the checklist', async () => {
    const { draftsToReview } = await import('../admin/content-health');
    const content = structuredClone(bundledContent);
    content.help = { contacts: [], tips: [{ textEn: 'A tip.', textAr: 'نصيحة.', textFr: 'Un conseil.', drafted: ['textFr'] }], phrases: [] };
    expect(draftsToReview(content).filter(r => r.kind === 'help')).toEqual([{ kind: 'help', id: 'tips-0', name: 'Tip 1', keys: ['textFr'] }]);
  });
});
