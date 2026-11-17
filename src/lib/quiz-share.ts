// The text shared after a "Which came first?" game (loaded with the quiz).

/**
 * The text shared after a game: "I got 4 of 5 on "Which came first?" on the
 * Coptic Cairo walk with Cairo Walks", or "… across Cairo …" without a route.
 */
export function quizShareText(score: number, of: number, routeName: string | null, lang: 'en' | 'ar' | 'fr' | 'es'): string {
  if (routeName === null) {
    if (lang === 'ar') return `أجبت ${score} من ${of} في مسابقة «أيهما بُني أولاً؟» عن آثار القاهرة مع Cairo Walks`;
    if (lang === 'fr') return `J’ai trouvé ${score} sur ${of} à « Lequel est le plus ancien ? » à travers le Caire avec Cairo Walks`;
    if (lang === 'es') return `He acertado ${score} de ${of} en «¿Cuál es más antiguo?» por todo El Cairo con Cairo Walks`;
    return `I got ${score} of ${of} on "Which came first?" across Cairo with Cairo Walks`;
  }
  if (lang === 'ar') return `أجبت ${score} من ${of} في مسابقة «أيهما بُني أولاً؟» في جولة ${routeName} مع Cairo Walks`;
  if (lang === 'fr') return `J’ai trouvé ${score} sur ${of} à « Lequel est le plus ancien ? » sur la visite ${routeName} avec Cairo Walks`;
  if (lang === 'es') return `He acertado ${score} de ${of} en «¿Cuál es más antiguo?» en el paseo ${routeName} con Cairo Walks`;
  return `I got ${score} of ${of} on "Which came first?" on the ${routeName} walk with Cairo Walks`;
}
