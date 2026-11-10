import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { glossaryOf, type Content } from '../data/content';
import { LANGS, LANGUAGES, OPTIONAL_LANGS, type Lang, type OptionalLang } from '../i18n/lang';
import { draftLang, draftSection, draftsToReview, markReviewed, GAPS, glossaryGaps, periodGaps, placeGaps, progress, routeGaps, translationPriority, type DraftRow, type Gap, type PlaceSection } from './content-health';
import { draftLabel } from './DraftReview';
import { inputClass } from './ui';
import type { SaveFn } from './AdminApp';
import { isExpired } from '../lib/notices';
import { cairoDate } from '../lib/special-hours';
import { languageShares } from '../lib/stats';
import { api } from './api';

/**
 * What content is still missing: progress per item, and the places (and
 * routes) that need something, each linking to the right part of its editor.
 */
export function ContentTab({ content, onEditPlace, onEditRoute, onEditTerm, onEditPeriod, onEditHelp, onEditNotices, save }: {
  content: Content;
  onEditPlace: (placeId: number, section: PlaceSection) => void;
  onEditRoute: (routeId: string) => void;
  onEditTerm: (termId: string) => void;
  onEditPeriod: (periodId: string) => void;
  onEditHelp?: () => void;
  onEditNotices?: () => void;
  /** Saves the content (Mark reviewed from the list); without it, only Edit is offered. */
  save?: SaveFn;
}) {
  const [filter, setFilter] = useState<Gap | 'all'>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');

  const items = useMemo(() => progress(content), [content]);
  // Each language's share of visitors over the last 30 days (from the Stats
  // tab's counts), shown beside its translation progress. Without stats (no
  // store, offline), the tiles are as before.
  // Visits per language (route opens and audio plays) and their rounded shares.
  const [langs, setLangs] = useState<{ visits: Partial<Record<Lang, number>>; pct: Partial<Record<Lang, number>> } | null>(null);
  useEffect(() => {
    let live = true;
    api
      .stats(30)
      .then(data => {
        const { rows, counted } = languageShares(data.total);
        if (live && counted > 0) setLangs({ visits: Object.fromEntries(rows.map(r => [r.lang, r.total])), pct: Object.fromEntries(rows.map(r => [r.lang, r.pct])) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const priority = langs ? translationPriority(items, langs.visits) : undefined;
  const rows = useMemo(
    () =>
      content.places
        .map(place => ({ place, gaps: placeGaps(place) }))
        .filter(({ place, gaps }) => gaps.length > 0 && (filter === 'all' || gaps.includes(filter)) && (routeFilter === 'all' || place.routeId === routeFilter)),
    [content.places, filter, routeFilter],
  );
  const routesMissing = content.routes.map(route => ({ route, gaps: routeGaps(route) })).filter(r => r.gaps.length > 0);
  const termsMissing = glossaryOf(content).map(t => ({ id: t.id, name: t.termEn, gaps: glossaryGaps(t) })).filter(r => r.gaps.length > 0);
  const periodsMissing = (content.specialPeriods ?? []).map(p => ({ id: p.id, name: p.nameEn, gaps: periodGaps(p) })).filter(r => r.gaps.length > 0);
  // Notices past their last day: visitors no longer see them, so they can go.
  const today = cairoDate(new Date());
  const ended = (content.notices ?? []).map((n, i) => ({ n, i })).filter(({ n }) => isExpired(n, today));
  const routeName = (id: string) => content.routes.find(r => r.id === id)?.nameEn ?? id;
  const sectionFor = (gaps: Gap[]) => GAPS.find(g => (filter === 'all' ? gaps.includes(g.id) : g.id === filter))!.section;

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(item => {
          const pct = item.total ? Math.round((item.done / item.total) * 100) : 100;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setFilter(active ? 'all' : item.id)}
              aria-pressed={active}
              className={`text-start bg-white rounded-2xl border p-4 transition-colors ${active ? 'border-nile ring-1 ring-nile' : 'border-sand/50 hover:border-nile/40'}`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{item.label}</p>
              <p className="mt-1 text-2xl font-serif text-ink">
                {item.done} <span className="text-sm text-stone-400">of {item.total}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-sand/40 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={item.total} aria-valuenow={item.done} aria-label={`${item.label}: ${item.done} of ${item.total} places`}>
                <div className="h-full bg-nile rounded-full" style={{ width: `${pct}%` }} />
              </div>
              {langs && (OPTIONAL_LANGS as readonly string[]).includes(item.id) && (
                <p className="mt-2 text-[11px] text-stone-500">{pct}% translated · {langs.pct[item.id as Lang] ?? 0}% of visitors</p>
              )}
            </button>
          );
        })}
      </div>
      {priority && (
        <p className="-mt-3 text-xs text-stone-600">
          Most worth translating next: <strong>{LANGUAGES[priority.lang].english}</strong>, used by {priority.pct || "under 1"}% of visitors in the last 30 days, with {priority.missing} {priority.missing === 1 ? 'place' : 'places'} still missing it.
        </p>
      )}

      <DraftsList
        content={content}
        save={save}
        onEdit={row => {
          if (row.kind === 'place') onEditPlace(Number(row.id), row.keys.map(draftSection).find(Boolean) ?? 'lang-fr');
          else if (row.kind === 'route') onEditRoute(row.id);
          else if (row.kind === 'term') onEditTerm(row.id);
          else if (row.kind === 'help') onEditHelp?.();
          else if (row.kind === 'notice') onEditNotices?.();
          else onEditPeriod(row.id);
        }}
      />
      <MissingList title="Routes" rows={routesMissing.map(({ route, gaps }) => ({ id: route.id, name: route.nameEn, gaps }))} onEdit={onEditRoute} />
      <MissingList title="Glossary terms" rows={termsMissing} onEdit={onEditTerm} />
      <MissingList title="Special hours" rows={periodsMissing} onEdit={onEditPeriod} />
      {ended.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand/50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Notices that have ended ({ended.length})</p>
          <ul className="divide-y divide-sand/40">
            {ended.map(({ n, i }) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">{n.textEn}</span>
                <span className="text-xs text-amber-800">Last day {n.until}</span>
                <button onClick={() => onEditNotices?.()} className="flex items-center gap-1 min-h-11 px-3 text-xs font-bold text-nile hover:underline" aria-label={`Edit notice ${i + 1}`}>
                  Edit <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-sand/50 p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500 flex-1">
            {filter === 'all' ? 'Places missing something' : `Places missing ${GAPS.find(g => g.id === filter)!.label.toLowerCase()}`} ({rows.length})
          </p>
          <select value={filter} onChange={e => setFilter(e.target.value as Gap | 'all')} className={`${inputClass} !w-auto`} aria-label="Missing">
            <option value="all">Anything missing</option>
            {GAPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} className={`${inputClass} !w-auto`} aria-label="Route">
            <option value="all">All routes</option>
            {content.routes.map(r => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-nile py-4">
            <CheckCircle2 className="w-4 h-4" /> Nothing missing here.
          </p>
        ) : (
          <ul className="divide-y divide-sand/40">
            {rows.map(({ place, gaps }) => (
              <li key={place.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink truncate">{place.nameEn}</span>
                  <span className="block text-xs text-stone-400">{routeName(place.routeId)}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {gaps.map(g => (
                    <span key={g} className={`px-2 py-0.5 rounded-full text-xs ${g === filter ? 'bg-amber-100 text-amber-900' : 'bg-chalk text-stone-600'}`}>
                      {GAPS.find(x => x.id === g)!.label}
                    </span>
                  ))}
                </span>
                <button onClick={() => onEditPlace(place.id, sectionFor(gaps))} className="flex items-center gap-1 min-h-11 px-3 text-xs font-bold text-nile hover:underline">
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Routes, glossary terms or special hours missing a language, each with a link to its editor. Nothing when none are. */
function MissingList({ title, rows, onEdit }: { title: string; rows: { id: string; name: string; gaps: OptionalLang[] }[]; onEdit: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-sand/50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{title} ({rows.length})</p>
      <ul className="divide-y divide-sand/40">
        {rows.map(row => (
          <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1">{row.name}</span>
            <span className="text-xs text-amber-800">Missing {row.gaps.map(g => LANGUAGES[g].english).join(', ')}</span>
            <button onClick={() => onEdit(row.id)} className="flex items-center gap-1 min-h-11 px-3 text-xs font-bold text-nile hover:underline" aria-label={`Edit ${row.name}`}>
              Edit <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KIND: Record<DraftRow['kind'], string> = { place: 'Place', route: 'Route', term: 'Glossary term', period: 'Special hours', help: 'Help sheet', notice: 'Notice' };

/** "Translations to review": what Gemini drafted and no one has checked yet, by language. Nothing when there's none. */
function DraftsList({ content, onEdit, save }: { content: Content; onEdit: (row: DraftRow) => void; save?: SaveFn }) {
  const [lang, setLang] = useState<Lang | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const all = useMemo(() => draftsToReview(content), [content]);
  if (all.length === 0) return null;
  const count = (l: Lang) => all.reduce((n, r) => n + r.keys.filter(k => draftLang(k) === l).length, 0);
  const rows = lang === 'all' ? all : draftsToReview(content, lang);
  const langNames = (keys: string[]) => [...new Set(keys.map(k => draftLang(k)).filter(Boolean))].map(l => LANGUAGES[l!].english).join(', ');
  // Marks drafts reviewed without opening their editors: one row, or every row shown in one language.
  const mark = async (marked: DraftRow[], note: string) => {
    if (!save || busy) return;
    setBusy(true);
    await save(markReviewed(content, marked), note);
    setBusy(false);
  };
  const markAll = () => {
    if (lang === 'all') return;
    const n = rows.reduce((sum, r) => sum + r.keys.length, 0);
    if (!window.confirm(`Mark all ${n} ${LANGUAGES[lang].english} drafts as reviewed? Only do this once you've checked them.`)) return;
    mark(rows, `Marked ${LANGUAGES[lang].english} translations reviewed (${n})`);
  };
  const chip = (active: boolean) => `min-h-9 px-3 rounded-full border text-xs font-bold ${active ? 'bg-nile/10 border-nile text-nile' : 'border-sand text-stone-600 hover:border-nile/50'}`;
  return (
    <div className="bg-white rounded-2xl border border-gold/50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Translations to review ({all.reduce((n, r) => n + r.keys.length, 0)})</p>
      <p className="mt-1 text-xs text-stone-500">Drafted by Gemini and not checked yet. Editing a field, or Mark reviewed here or in its editor, takes it off the list.</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Language">
        <button type="button" aria-pressed={lang === 'all'} onClick={() => setLang('all')} className={chip(lang === 'all')}>All</button>
        {LANGS.filter(l => count(l) > 0).map(l => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={chip(lang === l)}>
            {LANGUAGES[l].english} ({count(l)})
          </button>
        ))}
      </div>
      {save && lang !== 'all' && rows.length > 0 && (
        <button type="button" disabled={busy} onClick={markAll} className="mt-3 min-h-11 px-4 rounded-xl border border-sand text-xs font-bold text-ink hover:border-nile disabled:opacity-40">
          {busy ? 'Saving…' : `Mark all reviewed (${LANGUAGES[lang].english})`}
        </button>
      )}
      <ul className="mt-2 divide-y divide-sand/40">
        {rows.map(row => (
          <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block text-ink truncate">{row.name || row.id}</span>
              <span className="block text-xs text-stone-400">{KIND[row.kind]}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {row.keys.map(k => <span key={k} className="px-2 py-0.5 rounded-full text-xs bg-gold/15 text-ink">{draftLabel(k)}</span>)}
            </span>
            {save && (
              <button
                type="button"
                disabled={busy}
                onClick={() => mark([row], `Marked ${langNames(row.keys)} reviewed: ${row.name || row.id}`)}
                className="min-h-11 px-3 text-xs font-bold text-stone-600 hover:text-nile disabled:opacity-40"
                aria-label={`Mark reviewed: ${row.name || row.id}`}
              >
                Mark reviewed
              </button>
            )}
            <button onClick={() => onEdit(row)} className="flex items-center gap-1 min-h-11 px-3 text-xs font-bold text-nile hover:underline" aria-label={`Edit ${row.name || row.id}`}>
              Edit <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
