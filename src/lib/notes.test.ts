import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOTE_MAX, parseNotes, withNote } from './notes';

describe('notes', () => {
  it('sets, replaces and removes a note', () => {
    const a = withNote({}, 12, 'Come back at sunset');
    expect(a).toEqual({ 12: 'Come back at sunset' });
    expect(withNote(a, 12, 'Roof opens at 2')).toEqual({ 12: 'Roof opens at 2' });
    expect(withNote(a, 12, '   ')).toEqual({});
    expect(withNote(a, 7, 'x')).toEqual({ 12: 'Come back at sunset', 7: 'x' });
  });

  it('keeps notes within the limit', () => {
    expect(withNote({}, 1, 'a'.repeat(NOTE_MAX + 50))[1]).toHaveLength(NOTE_MAX);
  });

  it('reads stored notes, dropping anything malformed', () => {
    expect(parseNotes(null)).toEqual({});
    expect(parseNotes('[1]')).toEqual({});
    expect(parseNotes('{"12":"ok","x":"bad id","0":"zero","5":"  ","6":3,"7":"' + 'b'.repeat(600) + '"}')).toEqual({ 12: 'ok', 7: 'b'.repeat(NOTE_MAX) });
  });
});

describe('notes store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  const stub = (data: Map<string, string>, failWrites = false) =>
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (failWrites) throw new Error('QuotaExceeded');
          data.set(k, v);
        },
        removeItem: (k: string) => data.delete(k),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });

  it("builds on another tab's notes", async () => {
    vi.resetModules();
    const data = new Map<string, string>();
    stub(data);
    const { setNote } = await import('./notes');
    setNote(1, 'mine');
    data.set('cairo-walks:notes', JSON.stringify({ 1: 'mine', 2: 'other tab' }));
    setNote(3, 'again');
    expect(JSON.parse(data.get('cairo-walks:notes')!)).toEqual({ 1: 'mine', 2: 'other tab', 3: 'again' });
    setNote(1, '');
    setNote(2, '');
    setNote(3, '');
    expect(data.has('cairo-walks:notes')).toBe(false);
  });

  it("keeps this tab's notes when writes fail", async () => {
    vi.resetModules();
    stub(new Map(), true);
    const { setNote, notesNow } = await import('./notes');
    setNote(1, 'a');
    setNote(2, 'b');
    expect(notesNow()).toEqual({ 1: 'a', 2: 'b' });
  });
});
