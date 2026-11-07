/**
 * A short, stable hash of a text (FNV-1a, 32-bit, as 8 hex digits). Used to
 * version audio guide URLs by the description they narrate, so an edited
 * description gets a new URL that no cache has seen. Not for security.
 */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * The version in an audio guide's URL (?v=). It changed when transcripts were
 * added (the "t|" prefix), so no cache hands back a recording saved without one.
 */
export const audioVersion = (text: string) => textHash(`t|${text}`);
