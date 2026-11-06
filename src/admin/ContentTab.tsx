import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { glossaryOf, type Content } from '../data/content';
import { LANGUAGES, type OptionalLang } from '../i18n/lang';
import { GAPS, glossaryGaps, periodGaps, placeGaps, progress, routeGaps, type Gap, type PlaceSection } from './content-health';
import { inputClass } from './ui';

/**
 * What content is still missing: progress per item, and the places (and
 * routes) that need something, each linking to the right part of its editor.
 */
export function ContentTab({ content, onEditPlace, onEditRoute, onEditTerm, onEditPeriod }: {
  content: Content;
  onEditPlace: (placeId: number, section: PlaceSection) => void;
  onEditRoute: (routeId: string) => void;
  onEditTerm: (termId: string) => void;
  onEditPeriod: (periodId: string) => void;
}) {
  const [filter, setFilter] = useState<Gap | 'all'>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');

  const items = useMemo(() => progress(content), [content]);
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
            </button>
          );
        })}
      </div>

      <MissingList title="Routes" rows={routesMissing.map(({ route, gaps }) => ({ id: route.id, name: route.nameEn, gaps }))} onEdit={onEditRoute} />
      <MissingList title="Glossary terms" rows={termsMissing} onEdit={onEditTerm} />
      <MissingList title="Special hours" rows={periodsMissing} onEdit={onEditPeriod} />

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
