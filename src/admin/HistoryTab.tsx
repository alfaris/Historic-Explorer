import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Content } from '../data/content';
import { api, type HistoryEntry } from './api';
import type { SaveFn } from './AdminApp';
import { backupDiff, backupFile, describeChange, downloadFile, parseBackup, placesCsv, type BackupDiff } from './backup';
import { Button, ErrorBox, formatDate } from './ui';
import { changeCount, versionDiff, type SectionChanges } from './version-diff';

type Pending = { name: string; content: Content; savedAt: string | null; diff: BackupDiff };

/** Download the content as JSON or the places as CSV, and restore a JSON backup. */
function Backup({ content, save, onRestored }: { content: Content; save: SaveFn; onRestored: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<{ message: string; problems: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    setPending(null);
    setProblem(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setProblem({ message: 'This file is too large to be a backup.', problems: [] });
    const parsed = parseBackup(await file.text());
    if ('message' in parsed) return setProblem(parsed);
    setPending({ name: file.name, content: parsed.content, savedAt: parsed.savedAt, diff: backupDiff(content, parsed.content) });
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    const from = pending.savedAt ? ` (made ${formatDate(pending.savedAt)})` : '';
    const ok = await save(pending.content, `Restored from the backup file ${pending.name}${from}`);
    setBusy(false);
    if (ok) {
      setPending(null);
      onRestored();
    }
  };

  const cancel = () => setPending(null);

  return (
    <div className="rounded-xl bg-chalk border border-sand/50 p-4 mb-6">
      <h3 className="text-sm font-bold text-ink mb-1">Backup</h3>
      <p className="text-xs text-stone-500 mb-3">
        Keep a copy of the content outside the app. The JSON file can be restored here; the spreadsheet is for reading and sharing.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => downloadFile(backupFile(content))} className="flex items-center gap-2">
          <Download className="w-4 h-4" aria-hidden="true" /> Download backup (JSON)
        </Button>
        <Button type="button" variant="secondary" onClick={() => downloadFile(placesCsv(content))} className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" /> Download places (CSV)
        </Button>
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy} className="flex items-center gap-2">
          <Upload className="w-4 h-4" aria-hidden="true" /> Restore from a backup file
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Backup file to restore"
          onChange={e => {
            const file = e.target.files?.[0];
            // Cleared, so choosing the same file again (after editing it) still reads it.
            e.target.value = '';
            choose(file);
          }}
        />
      </div>
      {problem && (
        <div className="mt-3">
          <ErrorBox message={problem.message} problems={problem.problems} />
        </div>
      )}
      {pending && (
        <div className="mt-4 bg-white rounded-xl border border-sand/60 p-4" role="region" aria-label="Restore a backup">
          <p className="text-sm text-ink mb-2">
            <strong>{pending.name}</strong>
            {pending.savedAt && <span className="text-stone-500"> · made {formatDate(pending.savedAt)}</span>}
          </p>
          {pending.diff.same ? (
            <p className="text-sm text-stone-600">This backup is the same as the current content; there's nothing to restore.</p>
          ) : (
            <>
              <p className="text-sm text-stone-600 mb-1">Restoring it would give:</p>
              <ul className="text-sm text-stone-700 list-disc ps-5 mb-3">
                <li>{describeChange('Places', pending.diff.places)}</li>
                <li>{describeChange('Routes', pending.diff.routes)}</li>
                <li>{describeChange('Glossary terms', pending.diff.glossary)}</li>
                <li>{describeChange('Special hours', pending.diff.specialPeriods)}</li>
              </ul>
              <p className="text-xs text-stone-500 mb-3">It's saved as one new version, so the current one stays in the history below.</p>
            </>
          )}
          <div className="flex gap-2">
            {!pending.diff.same && (
              <Button type="button" onClick={restore} disabled={busy}>
                {busy ? 'Restoring…' : 'Restore this backup'}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>
              {pending.diff.same ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The changes between two versions, by section: added, deleted, and edited fields (old → new). */
function DiffList({ diff, empty }: { diff: SectionChanges[]; empty: string }) {
  if (diff.length === 0) return <p className="text-sm text-stone-600">{empty}</p>;
  return (
    <div className="space-y-3">
      {diff.map(s => (
        <div key={s.section}>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">{s.section} ({s.items.length})</p>
          <ul className="space-y-1.5 text-sm">
            {s.items.map((item, i) => (
              <li key={i}>
                <span className={`me-2 text-[10px] font-bold uppercase tracking-widest ${item.kind === 'added' ? 'text-nile' : item.kind === 'deleted' ? 'text-red-700' : 'text-gold-ink'}`}>
                  {item.kind}
                </span>
                <span className="text-ink">{item.name}</span>
                {item.kind === 'edited' && (
                  <ul className="mt-1 ms-4 space-y-0.5 text-xs text-stone-600">
                    {item.movedMeters !== undefined && <li>Pin moved {item.movedMeters} m</li>}
                    {item.fields.map(f => (
                      <li key={f.field} className="break-words">
                        <span className="font-mono text-stone-500">{f.field}</span>: <del className="text-stone-400">{f.before}</del> → <ins className="no-underline text-ink">{f.after}</ins>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type Shown = { pathname: string; mode: 'changed' | 'now'; diff: SectionChanges[] };

/** Every save is kept; restoring publishes an old version as a new save. */
export function HistoryTab({ content, save }: { content: Content; save: SaveFn }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // "What changed" / "Compare with now", for one version at a time.
  const [shown, setShown] = useState<Shown | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  // The current content, read when a comparison finishes (it may have been restored meanwhile).
  const current = useRef(content);
  current.current = content;
  // A "Compare with now" was against the content as it was: when that changes (a restore, a save), it's closed.
  useEffect(() => {
    setShown(s => (s?.mode === 'now' ? null : s));
  }, [content]);
  // Versions already fetched (they never change), by pathname.
  const versions = useRef(new Map<string, Content>());
  const fetchVersion = async (pathname: string) => {
    const kept = versions.current.get(pathname);
    if (kept) return kept;
    const { content: c } = await api.version(pathname);
    const { note: _note, ...rest } = c;
    versions.current.set(pathname, rest);
    return rest;
  };
  // What this save changed (from the one before it), or what restoring it would change now.
  const compare = async (i: number, mode: Shown['mode']) => {
    if (!history) return;
    const entry = history[i];
    if (shown?.pathname === entry.pathname && shown.mode === mode) return setShown(null);
    setComparing(`${entry.pathname}:${mode}`);
    setError(null);
    try {
      const version = await fetchVersion(entry.pathname);
      const diff = mode === 'changed' ? versionDiff(await fetchVersion(history[i + 1].pathname), version) : versionDiff(current.current, version);
      setShown({ pathname: entry.pathname, mode, diff });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setComparing(null);
    }
  };

  const load = () =>
    api
      .history()
      .then(d => setHistory(d.history))
      .catch(err => setError((err as Error).message));

  useEffect(() => {
    load();
  }, []);

  const restore = async (entry: HistoryEntry) => {
    if (!window.confirm(`Restore the version saved ${formatDate(entry.savedAt)}? The current version stays in the history.`)) return;
    setBusy(entry.pathname);
    try {
      const { content } = await api.version(entry.pathname);
      const { note: _note, ...rest } = content;
      if (await save(rest, `Restored the version from ${formatDate(entry.savedAt)}`)) await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-sand/50 p-6">
      <h2 className="text-xl font-serif mb-1">History</h2>
      <p className="text-sm text-stone-500 mb-4">Each save is kept here. Restoring an old version saves it again as the current one.</p>
      <Backup content={content} save={save} onRestored={load} />
      {error && <ErrorBox message={error} />}
      {!history ? (
        <p className="text-stone-500">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-stone-500">No saves yet. The site is using the built-in content.</p>
      ) : (
        <ul className="divide-y divide-sand/40">
          {history.map((h, i) => {
            const open = shown?.pathname === h.pathname ? shown : null;
            const link = (mode: Shown['mode'], label: string) => (
              <button
                type="button"
                onClick={() => compare(i, mode)}
                aria-expanded={open?.mode === mode}
                disabled={comparing !== null}
                className="min-h-11 px-3 text-xs font-bold text-nile hover:underline disabled:opacity-40"
              >
                {comparing === `${h.pathname}:${mode}` ? 'Loading…' : label}
              </button>
            );
            return (
              <li key={h.pathname} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-ink">
                      {formatDate(h.savedAt)} {i === 0 && <span className="text-[10px] font-bold uppercase tracking-widest text-nile ms-2">Current</span>}
                    </p>
                    <p className="text-[11px] text-stone-400">{Math.round(h.size / 1024)} KB</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {i < history.length - 1 && link('changed', 'What changed')}
                    {i > 0 && link('now', 'Compare with now')}
                    {i > 0 && (
                      <Button variant="secondary" onClick={() => restore(h)} disabled={busy !== null}>
                        {busy === h.pathname ? 'Restoring…' : 'Restore'}
                      </Button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="mt-3 rounded-xl border border-sand/60 bg-chalk/40 p-4" role="region" aria-label={open.mode === 'changed' ? 'What this save changed' : 'What restoring it would change'}>
                    <p className="text-xs text-stone-500 mb-3">
                      {open.mode === 'changed'
                        ? `What this save changed, from the version before it (${changeCount(open.diff)} ${changeCount(open.diff) === 1 ? 'change' : 'changes'}).`
                        : `What restoring this version would change in the current content (${changeCount(open.diff)} ${changeCount(open.diff) === 1 ? 'change' : 'changes'}).`}
                    </p>
                    <DiffList diff={open.diff} empty={open.mode === 'changed' ? 'No difference in the content.' : 'This version is the same as the current content.'} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
