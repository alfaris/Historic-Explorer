import { describe, expect, it } from 'vitest';
import { bundledContent } from '../data/content';
import { withDraft } from './PlacePreview';

describe('withDraft', () => {
  const [first, second] = bundledContent.places;
  it('puts the draft in place of the saved place, leaving the content as it was', () => {
    const draft = { ...first, descriptionEn: 'Edited.' };
    const preview = withDraft(bundledContent, draft);
    expect(preview.places.find(p => p.id === first.id)).toBe(draft);
    expect(preview.places.indexOf(draft)).toBe(0);
    expect(preview.places).toHaveLength(bundledContent.places.length);
    expect(bundledContent.places[0]).toBe(first);
    expect(preview.places[1]).toBe(second);
  });
  it('adds a new place', () => {
    const draft = { ...first, id: 99999 };
    expect(withDraft(bundledContent, draft).places.at(-1)).toBe(draft);
  });
});
