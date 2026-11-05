import React, { useEffect, useState } from 'react';
import { api, type HistoryEntry } from './api';
import type { SaveFn } from './AdminApp';
import { Button, ErrorBox, formatDate } from './ui';

/** Every save is kept; restoring publishes an old version as a new save. */
export function HistoryTab({ save }: { save: SaveFn }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      {error && <ErrorBox message={error} />}
      {!history ? (
        <p className="text-stone-500">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-stone-500">No saves yet. The site is using the built-in content.</p>
      ) : (
        <ul className="divide-y divide-sand/40">
          {history.map((h, i) => (
            <li key={h.pathname} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-ink">
                  {formatDate(h.savedAt)} {i === 0 && <span className="text-[10px] font-bold uppercase tracking-widest text-nile ms-2">Current</span>}
                </p>
                <p className="text-[11px] text-stone-400">{Math.round(h.size / 1024)} KB</p>
              </div>
              {i > 0 && (
                <Button variant="secondary" onClick={() => restore(h)} disabled={busy !== null}>
                  {busy === h.pathname ? 'Restoring…' : 'Restore'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
