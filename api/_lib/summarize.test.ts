import { describe, expect, it } from 'vitest';
import { parseSummarizeRequest, pickSummaries, summarizePrompt } from './summarize';

describe('summarize', () => {
  it('needs an English description and keeps only known languages', () => {
    expect(parseSummarizeRequest({ name: 'X', descriptions: { ar: 'نص' } })).toEqual({ error: 'Write the English description first.' });
    expect(parseSummarizeRequest({ name: '  Ibn Tulun ', descriptions: { en: ' A mosque. ', ar: 'مسجد', de: 'Moschee', fr: '' } }))
      .toEqual({ name: 'Ibn Tulun', descriptions: { en: 'A mosque.', ar: 'مسجد' } });
    expect(parseSummarizeRequest(null)).toEqual({ error: 'Write the English description first.' });
  });

  it('turns the reply into one-line fields of at most 160 characters', () => {
    expect(pickSummaries({ en: '  A mosque\nwith a spiral minaret. ', ar: 'مسجد', fr: 'x'.repeat(200), es: 3, de: 'nein' }))
      .toEqual({ summaryEn: 'A mosque with a spiral minaret.', summaryAr: 'مسجد', summaryFr: 'x'.repeat(160) });
    expect(pickSummaries('nope')).toEqual({});
  });

  it('gives Gemini the descriptions and the rules', () => {
    const prompt = summarizePrompt('Ibn Tulun', { en: 'A 9th-century mosque.', ar: 'مسجد من القرن التاسع.' });
    expect(prompt).toContain('"Ibn Tulun"');
    expect(prompt).toContain('Description (English):\nA 9th-century mosque.');
    expect(prompt).toContain('Description (Arabic):\nمسجد من القرن التاسع.');
    expect(prompt).toContain('At most 140 characters');
  });
});
