import React, { useEffect, useRef, useState } from 'react';
import { Check, Hourglass, RotateCcw, Share2, X } from 'lucide-react';
import type { Location } from '../data/locations';
import { photoAltOf, photoForPlace } from '../data/photo-resolve';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';
import { builtLabel } from '../lib/eras';
import { quizRounds, quizShareText, type Round } from '../lib/quiz';
import { routeShareUrl } from '../lib/share';
import { recordScore, useQuizBests } from '../lib/quiz-best';
import { track } from '../lib/track';
import { PlacePhoto } from './PlacePhoto';

// "Which came first?" on the finish screen (loaded when it's opened): a few
// rounds of two places from the route, tap the older one, then the score.
// Everything is on the device, so it works offline.

/**
 * Shares the score through the phone's share sheet, or copies the text and
 * link. Returns whether it was copied (to show "Copied").
 */
async function shareScore(title: string, text: string, url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return false;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false; // The visitor closed the sheet.
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return true;
  } catch {
    window.prompt(L('Copy the link:', 'انسخ الرابط:'), `${text} ${url}`);
    return false;
  }
}

export default function WhichCameFirst({ places, routeId, routeName, onClose }: { places: Location[]; routeId: string; routeName: string; onClose: () => void }) {
  const [rounds, setRounds] = useState<Round<Location>[]>(() => quizRounds(places, routeId));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Location | null>(null);
  const [score, setScore] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  // This game's result against the best on this device: null until the game ends.
  const [newBest, setNewBest] = useState<boolean | null>(null);
  const best = useQuizBests()[routeId];
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = quizShareText(score, rounds.length, routeName, lang);
    if (await shareScore(title, text, routeShareUrl(window.location.origin, routeId))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };
  const lang = currentLang();
  const done = index >= rounds.length;
  const round = done ? null : rounds[index];

  // A finished game is recorded once, as it ends.
  useEffect(() => {
    if (done && newBest === null && rounds.length) {
      setNewBest(recordScore(routeId, score, rounds.length));
      // The anonymous usage counts take the first game per route per visit.
      track({ t: 'quiz', id: routeId, s: score, n: rounds.length });
    }
  }, [done, newBest, rounds.length, routeId, score]);

  // Each new round (and the score) starts reading from the top for screen readers and keyboards.
  useEffect(() => {
    heading.current?.focus();
  }, [index, rounds]);

  const pick = (place: Location) => {
    if (picked || !round) return;
    setPicked(place);
    if (place.id === round.older.id) setScore(s => s + 1);
  };
  const next = () => {
    setPicked(null);
    setIndex(i => i + 1);
  };
  const again = () => {
    setRounds(quizRounds(places, routeId));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setNewBest(null);
  };

  const right = picked && round && picked.id === round.older.id;
  const title = L('Which came first?', 'أيهما بُني أولاً؟');

  return (
    <section aria-labelledby="quiz-title" className="relative rounded-3xl border border-sand bg-chalk p-4 text-start mb-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 end-2 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink"
        aria-label={L('Close the quiz', 'إغلاق المسابقة')}
      >
        <X className="w-5 h-5" />
      </button>
      <h3 id="quiz-title" ref={heading} tabIndex={-1} className={`flex items-center gap-2 pe-10 text-lg text-ink outline-none ${lang === 'ar' ? 'font-arabic font-bold' : 'font-serif'}`}>
        <Hourglass className="w-5 h-5 text-gold-ink shrink-0" aria-hidden="true" />
        {title}
      </h3>

      {round ? (
        <>
          <p className="mt-1 mb-3 text-sm text-stone-600">
            <span className="font-bold text-ink">
              {byLang({
                en: `Round ${index + 1} of ${rounds.length}.`,
                ar: `الجولة ${index + 1} من ${rounds.length}.`,
                fr: `Manche ${index + 1} sur ${rounds.length}.`,
                es: `Ronda ${index + 1} de ${rounds.length}.`,
              })}
            </span>{' '}
            {L('Tap the place that was built first.', 'اضغط على المكان الذي بُني أولاً.')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[round.a, round.b].map(place => {
              const isOlder = place.id === round.older.id;
              const chosen = picked?.id === place.id;
              const state = !picked ? 'border-sand bg-white hover:border-nile/60' : isOlder ? 'border-nile bg-nile/10' : chosen ? 'border-gold-ink bg-gold/10' : 'border-sand bg-white opacity-80';
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => pick(place)}
                  aria-disabled={!!picked}
                  aria-pressed={picked ? chosen : undefined}
                  className={`flex flex-col overflow-hidden rounded-2xl border-2 text-start ${state}`}
                >
                  <PlacePhoto
                    photo={photoForPlace(place)}
                    alt={photoAltOf(place)}
                    tapToShow={false}
                    className="w-full aspect-[4/3]"
                    sizes="200px"
                    fallback={<div className="w-full aspect-[4/3] bg-nile/10" />}
                  />
                  <span className="block p-2 text-sm font-bold text-ink leading-snug">{nameOf(place)}</span>
                  {picked && (
                    <span className="flex items-start gap-1 px-2 pb-2 text-xs text-stone-600">
                      {isOlder && <Check className="w-4 h-4 text-nile shrink-0" aria-hidden="true" />}
                      {builtLabel(place, lang)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="mt-3 min-h-6 text-sm font-bold text-ink">
            {picked && (
              <>
                {right ? L('Right!', 'صحيح!') : L('Not quite.', 'ليس تماماً.')}{' '}
                {byLang({
                  en: `${nameOf(round.older)} came first.`,
                  ar: `الأقدم: ${nameOf(round.older)}.`,
                  fr: `${nameOf(round.older)} est le plus ancien.`,
                  es: `${nameOf(round.older)} es el más antiguo.`,
                })}
              </>
            )}
          </p>
          {picked && (
            <button type="button" onClick={next} className="mt-2 w-full min-h-11 rounded-2xl bg-nile px-4 text-sm font-bold text-white hover:bg-nile/90">
              {index + 1 < rounds.length ? L('Next', 'التالي') : L('See my score', 'اعرض نتيجتي')}
            </button>
          )}
        </>
      ) : (
        <div className="mt-2 text-center">
          <p className="text-2xl font-bold text-ink" aria-live="polite">
            {byLang({
              en: `You got ${score} of ${rounds.length}`,
              ar: `إجاباتك الصحيحة: ${score} من ${rounds.length}`,
              fr: `Vous avez trouvé ${score} sur ${rounds.length}`,
              es: `Has acertado ${score} de ${rounds.length}`,
            })}
          </p>
          {newBest ? (
            <p className="mt-1 text-sm font-bold text-nile">{L('New best!', 'أفضل نتيجة جديدة!')}</p>
          ) : (
            best && (
              <p className="mt-1 text-sm text-stone-600">
                {byLang({
                  en: `Your best: ${best.score} of ${best.of}`,
                  ar: `أفضل نتيجة لك: ${best.score} من ${best.of}`,
                  fr: `Votre record : ${best.score} sur ${best.of}`,
                  es: `Tu mejor resultado: ${best.score} de ${best.of}`,
                })}
              </p>
            )
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={again}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-2xl bg-white border border-sand px-4 text-sm font-bold text-ink hover:border-nile/60"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> {L('Play again', 'العب مرة أخرى')}
            </button>
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-2xl bg-white border border-sand px-4 text-sm font-bold text-ink hover:border-nile/60"
            >
              {copied ? <Check className="w-4 h-4 text-nile" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
              {copied ? L('Copied', 'تم النسخ') : L('Share', 'مشاركة')}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">{copied ? L('Copied', 'تم النسخ') : ''}</p>
        </div>
      )}
    </section>
  );
}
