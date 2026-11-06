import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, BookOpen, History, Inbox, ListChecks, LogOut, MapPinned, Route as RouteIcon } from 'lucide-react';
import type { Content } from '../data/content';
import { normalizeContent, validateContent, withMaxPlaceId } from '../data/content';
import { api, ApiError } from './api';
import { ReportsTab } from './ReportsTab';
import { PlacesTab } from './PlacesTab';
import { RoutesTab } from './RoutesTab';
import { ContentTab } from './ContentTab';
import type { PlaceSection } from './content-health';
import { HistoryTab } from './HistoryTab';
import { StatsTab } from './StatsTab';
import { GlossaryTab } from './GlossaryTab';
import { Button, ErrorBox } from './ui';

export type SaveFn = (next: Content, note: string) => Promise<boolean>;

export function AdminApp() {
  const [session, setSession] = useState<{ configured: boolean; signedIn: boolean } | null>(null);

  useEffect(() => {
    api.session().then(setSession).catch(() => setSession({ configured: true, signedIn: false }));
  }, []);

  if (!session) return <Centered>Loading…</Centered>;
  if (!session.configured) {
    return (
      <Centered>
        <h1 className="text-xl font-serif mb-3">Admin isn’t set up yet</h1>
        <p className="text-sm text-stone-600 max-w-md">
          Add an <code>ADMIN_PASSWORD</code> environment variable (at least 12 characters) in the Vercel project settings, then redeploy.
        </p>
      </Centered>
    );
  }
  if (!session.signedIn) return <Login onSignedIn={() => setSession({ ...session, signedIn: true })} />;
  return <Dashboard onSignedOut={() => setSession({ ...session, signedIn: false })} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">{children}</main>;
}

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Centered>
      <form
        className="bg-white rounded-3xl shadow-xl border border-sand/50 p-8 w-full max-w-sm text-start"
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.login(password);
            onSignedIn();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink mb-1">Cairo Walks</p>
        <h1 className="text-2xl font-serif mb-6">Admin</h1>
        <label className="block text-xs font-bold text-stone-500 mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-xl border border-sand/60 p-3 mb-4 focus:outline-none focus:border-nile"
          autoFocus
        />
        {error && <ErrorBox message={error} />}
        <Button type="submit" disabled={busy || !password} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Centered>
  );
}

type Tab = 'reports' | 'content' | 'places' | 'routes' | 'glossary' | 'stats' | 'history';

function Dashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [tab, setTab] = useState<Tab>('reports');
  const [content, setContent] = useState<Content | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ message: string; problems: string[]; conflict: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editPlaceId, setEditPlaceId] = useState<number | null>(null);
  // Which part of the place editor to scroll to (a "closed" report opens the hours).
  const [editSection, setEditSection] = useState<PlaceSection | null>(null);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.content();
      // The server already normalizes; doing it here too keeps the editors on the current model.
      setContent(normalizeContent(data.content));
      setEtag(data.etag);
      setLoadError(null);
      setSaveError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSignedOut();
      setLoadError((err as Error).message);
    }
  }, [onSignedOut]);

  useEffect(() => {
    load();
  }, [load]);

  // Every edit publishes the whole content, guarded by the ETag so two admins
  // can't silently overwrite each other.
  const save: SaveFn = async (next, note) => {
    setNotice(null);
    // Remember the highest place ID ever used, so a deleted place's ID isn't reused.
    if (content) next = withMaxPlaceId(next, content);
    const problems = validateContent(next);
    if (problems.length) {
      setSaveError({ message: 'Fix these before saving:', problems, conflict: false });
      return false;
    }
    try {
      const { etag: newEtag } = await api.saveContent(next, etag, note);
      setContent(next);
      setEtag(newEtag);
      setSaveError(null);
      setNotice(`Saved: ${note}. Visitors see it within about a minute.`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSignedOut();
        return false;
      }
      const e = err as ApiError;
      setSaveError({ message: e.message, problems: e.problems ?? [], conflict: e.status === 409 });
      return false;
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'reports', label: 'Reports', icon: <Inbox className="w-4 h-4" /> },
    { id: 'content', label: 'Content', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'places', label: 'Places', icon: <MapPinned className="w-4 h-4" /> },
    { id: 'routes', label: 'Routes', icon: <RouteIcon className="w-4 h-4" /> },
    { id: 'glossary', label: 'Glossary', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-sand/50 sticky top-0 z-[2000]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="me-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-ink">Cairo Walks</p>
            <h1 className="text-lg font-serif leading-none">Admin</h1>
          </div>
          <nav className="flex gap-1 bg-chalk p-1 rounded-xl order-last md:order-none w-full md:w-auto overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest whitespace-nowrap ${
                  tab === t.id ? 'bg-white text-nile shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
          <a href="/" className="text-xs text-stone-500 hover:text-nile">
            View site
          </a>
          <button
            onClick={async () => {
              await api.logout().catch(() => {});
              onSignedOut();
            }}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-nile"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {loadError && <ErrorBox message={`Couldn't load content: ${loadError}`} />}
        {saveError && (
          <ErrorBox message={saveError.message} problems={saveError.problems}>
            {saveError.conflict && (
              <Button variant="secondary" onClick={load} className="mt-3">
                Reload latest content
              </Button>
            )}
          </ErrorBox>
        )}
        {notice && <div className="rounded-2xl bg-nile/10 text-nile text-sm p-4">{notice}</div>}
        {etag === null && content && (
          <div className="rounded-2xl bg-gold/10 text-stone-700 text-sm p-4">
            You’re seeing the built-in content. Your first save stores a live copy that the site will use from then on.
          </div>
        )}

        {!content ? (
          !loadError && <p className="text-stone-500">Loading content…</p>
        ) : tab === 'reports' ? (
          <ReportsTab
            content={content}
            save={save}
            onEditPlace={(id, section) => {
              setEditPlaceId(id);
              setEditSection(section ?? null);
              setTab('places');
            }}
            onSignedOut={onSignedOut}
          />
        ) : tab === 'content' ? (
          <ContentTab
            content={content}
            onEditPlace={(id, section) => {
              setEditPlaceId(id);
              setEditSection(section);
              setTab('places');
            }}
            onEditRoute={id => {
              setEditRouteId(id);
              setTab('routes');
            }}
          />
        ) : tab === 'places' ? (
          <PlacesTab content={content} save={save} initialPlaceId={editPlaceId} initialSection={editSection} onSelected={() => { setEditPlaceId(null); setEditSection(null); }} />
        ) : tab === 'routes' ? (
          <RoutesTab content={content} save={save} initialRouteId={editRouteId} onSelected={() => setEditRouteId(null)} />
        ) : tab === 'glossary' ? (
          <GlossaryTab content={content} save={save} />
        ) : tab === 'stats' ? (
          <StatsTab content={content} onSignedOut={onSignedOut} />
        ) : (
          <HistoryTab save={save} />
        )}
      </main>
    </div>
  );
}
