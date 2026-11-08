import React, { useMemo, useState } from 'react';
import { ChevronDown, Compass } from 'lucide-react';
import type { Location, Route } from '../data/locations';
import { formatDuration } from '../lib/route-format';
import { INTERESTS, suggestRoutes, type Interest, type TimeChoice } from '../lib/route-finder';
import { hasAccessInfo, routeAccess, stepFreeText } from '../lib/step-free';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';

const TIMES: TimeChoice[] = ['short', 'medium', 'long'];
const timeLabel = (t: TimeChoice) => (t === 'short' ? L('About 1 hour', 'ساعة تقريبًا') : t === 'medium' ? L('2 to 3 hours', 'من ساعتين إلى 3') : L('Half a day', 'نصف يوم'));
const interestLabel = (i: Interest) =>
  i === 'mosques' ? L('Mosques and shrines', 'مساجد وأضرحة') : i === 'museums' ? L('Museums and old houses', 'متاحف وبيوت قديمة') : i === 'food' ? L('Food and cafés', 'طعام ومقاهٍ') : L('Crafts', 'حِرف');

/** "8 mosques and shrines" and so on, for the reason under a suggestion. */
const countText = (i: Interest, n: number) => {
  const s = n === 1 ? '' : 's';
  switch (i) {
    case 'mosques': return byLang({ en: n === 1 ? '1 mosque or shrine' : `${n} mosques and shrines`, ar: `مساجد وأضرحة: ${n}`, fr: `${n} mosquée${s} et mausolée${s}`, es: `${n} mezquita${s} y mausoleo${s}` });
    case 'museums': return byLang({ en: `${n} monument${s} and house${s}`, ar: `آثار وبيوت: ${n}`, fr: `${n} monument${s} et maison${s}`, es: `${n} monumento${s} y casa${s}` });
    case 'food': return byLang({ en: `${n} café${s} and restaurant${s}`, ar: `مقاهٍ ومطاعم: ${n}`, fr: `${n} café${s} et restaurant${s}`, es: `${n} café${s} y restaurante${n === 1 ? '' : 's'}` });
    case 'crafts': return byLang({ en: `${n} craft shop${s}`, ar: `حرف وورش: ${n}`, fr: `${n} boutique${s} d’artisan${s}`, es: `${n} taller${n === 1 ? '' : 'es'} y tienda${s}` });
  }
};

/**
 * "Help me choose": three quick questions (time, interests and step-free
 * access) and the one or two routes that fit best, with why. Works offline, from the routes' times
 * and their places.
 */
export function RouteFinder({ routes, places, onPick }: { routes: Route[]; places: Location[]; onPick: (routeId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<TimeChoice | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [stepFree, setStepFree] = useState(false);
  const suggestions = useMemo(() => suggestRoutes(routes, places, time, interests, stepFree), [routes, places, time, interests, stepFree]);
  const lang = currentLang();

  const reason = (s: (typeof suggestions)[number]) => {
    // The chosen interests, or (with none chosen) what the route has most of.
    const shown = (interests.length ? interests : [...INTERESTS].sort((a, b) => s.profile[b] - s.profile[a]).slice(0, 2)).filter(i => s.profile[i] > 0);
    const access = routeAccess(places, s.route.id);
    // Asked for step-free access: how much of the walk is, or that it isn't known yet.
    const accessText = stepFree ? (hasAccessInfo(access) ? stepFreeText(access) : L('Step-free access not yet checked', 'لم يُتحقق بعد من الدخول بدون درجات')) : '';
    return [formatDuration(s.route.hoursMin, s.route.hoursMax, lang), accessText, ...shown.map(i => countText(i, s.profile[i]))].filter(Boolean).join(' · ');
  };

  const chip = (active: boolean) =>
    `min-h-11 px-4 rounded-full border text-xs font-bold transition-colors ${active ? 'bg-nile/10 border-nile text-nile' : 'bg-white border-sand text-stone-600 hover:border-nile/50'}`;

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="route-finder" className="inline-flex items-center gap-1.5 min-h-11 px-1 text-xs font-bold text-nile">
        <Compass className="w-4 h-4" aria-hidden="true" />
        {L('Help me choose a walk', 'ساعدني في اختيار جولة')}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="route-finder" className="mt-2 bg-white rounded-3xl border border-sand/50 p-4 space-y-4">
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{L('How much time do you have?', 'كم لديك من الوقت؟')}</legend>
            <div className="flex flex-wrap gap-2">
              {TIMES.map(t => (
                <button key={t} type="button" aria-pressed={time === t} onClick={() => setTime(cur => (cur === t ? null : t))} className={chip(time === t)}>
                  {timeLabel(t)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{L('What do you enjoy?', 'ما الذي تستمتع به؟')}</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(i => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={interests.includes(i)}
                  onClick={() => setInterests(cur => (cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]))}
                  className={chip(interests.includes(i))}
                >
                  {interestLabel(i)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{L('Do you need step-free access?', 'هل تحتاج إلى دخول بدون درجات؟')}</legend>
            <button type="button" aria-pressed={stepFree} onClick={() => setStepFree(v => !v)} className={chip(stepFree)}>
              {L('Yes, step-free', 'نعم، بدون درجات')}
            </button>
          </fieldset>

          <div aria-live="polite">
            {suggestions.length === 0 ? (
              <p className="text-sm text-stone-500">{L('Answer a question to see a suggestion.', 'أجب عن سؤال لترى اقتراحًا.')}</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={s.route.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-sand/60 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold uppercase tracking-widest text-gold-ink">{i === 0 ? L('Best fit', 'الأنسب') : L('Also good', 'خيار جيد أيضًا')}</span>
                      <span className="block text-sm text-ink">{nameOf(s.route)}</span>
                      <span className="block text-xs text-stone-600">{reason(s)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(s.route.id);
                        setOpen(false);
                      }}
                      className="min-h-11 px-4 rounded-xl bg-nile text-white text-xs font-bold uppercase tracking-wider hover:bg-nile-light"
                    >
                      {L('Show this walk', 'اعرض هذه الجولة')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {(time || interests.length > 0 || stepFree) && (
            <button type="button" onClick={() => { setTime(null); setInterests([]); setStepFree(false); }} className="min-h-11 text-xs font-bold text-stone-500 underline underline-offset-4">
              {L('Clear', 'مسح')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
