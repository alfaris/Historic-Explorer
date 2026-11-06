// Place search that forgives how people type names: in Arabic it ignores
// vowel marks, tatweel and letter variants (أ إ آ ٱ → ا, ة → ه, ى → ي,
// ؤ → و, ئ → ي); in English it ignores case, accents, hyphens and
// apostrophes, so "rifai" finds "Al-Rifa'i" and "السيده نفيسه" finds
// "السيدة نفيسة". Runs on the content in the app, so it works offline.

/** Folds a name or query to a plain form for matching. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '') // Latin accents
    .replace(/[ً-ٰٟـ]/g, '') // Arabic vowel marks, dagger alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/['’‘`\-]/g, '') // Al-Rifa'i → alrifai
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

type Searchable = { id: number; nameEn: string; nameAr: string; nameFr?: string; nameEs?: string };

/**
 * How well a place matches: 3 = a name starts with the query, 2 = a word in
 * it does, 1 = it's contained anywhere, 0 = no match. Every word of the query
 * must appear (in any language's name).
 */
export function matchScore(place: Searchable, query: string): number {
  const q = normalizeForSearch(query);
  if (!q) return 0;
  const names = [place.nameEn, place.nameAr, place.nameFr ?? '', place.nameEs ?? ''].filter(Boolean).map(normalizeForSearch);
  // Also try the English name with spaces removed, so "alazhar" finds "Al Azhar".
  const joined = names.map(n => n.replace(/ /g, ''));
  const words = q.split(' ');
  const has = (w: string) => names.some(n => n.includes(w)) || joined.some(n => n.includes(w));
  if (!words.every(has)) return 0;
  if (names.some(n => n.startsWith(q)) || joined.some(n => n.startsWith(q.replace(/ /g, '')))) return 3;
  if (names.some(n => n.split(' ').some(part => part.startsWith(words[0])))) return 2;
  return 1;
}

/** Places matching the query, best first (then in their list order). */
export function searchPlaces<T extends Searchable>(places: T[], query: string): T[] {
  return places
    .map((place, i) => ({ place, i, score: matchScore(place, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(r => r.place);
}
