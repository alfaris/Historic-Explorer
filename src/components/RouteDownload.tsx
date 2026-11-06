import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Download, RefreshCw, Trash2, WifiOff, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Location, Route } from '../data/locations';
import { routePack } from '../lib/offline-pack';
import { L, currentLang, byLang } from '../i18n/lang';
import {
  filesStillCached,
  missingFiles,
  offlineSupported,
  removeRoute,
  savedRouteKey,
  saveRoute,
  useOfflineRoutes,
  type Progress,
} from '../lib/offline-store';

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
};

const formatSize = (bytes: number, ar: boolean) => {
  const mb = bytes / (1024 * 1024);
  const value = mb >= 10 ? Math.round(mb).toString() : mb.toFixed(1);
  return ar ? `${value} ميجابايت` : `${value} ${L('MB', 'ميجابايت')}`;
};

/**
 * Saves a route (audio guides in the current language, photos and map) so it
 * works with no connection, and shows whether the saved copy is up to date.
 */
export function RouteDownload({ route, places }: { route: Route; places: Location[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const lang = currentLang();
  const online = useOnline();
  const saved = useOfflineRoutes();
  const key = savedRouteKey(route.id, lang);
  const savedRoute = saved[key];

  const needed = useMemo(() => routePack(route, places, lang), [route, places, lang]);
  const missing = useMemo(() => missingFiles(savedRoute, needed), [savedRoute, needed]);
  const retryOnly = !!savedRoute && missing.length > 0 && missing.every(f => savedRoute.failed.includes(f.url));
  const missingAudio = missing.filter(f => f.kind === 'audio').length;

  // Browsers may clear cached files (low space, cleared site data). Check the
  // saved copy is still all there whenever it changes.
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    setCleared(false);
    if (!savedRoute) return;
    let active = true;
    filesStillCached(savedRoute).then(ok => active && setCleared(!ok));
    return () => {
      active = false;
    };
  }, [savedRoute]);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!offlineSupported() || needed.length === 0) return null;

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    try {
      const result = await saveRoute(key, needed, { signal: controller.signal, onProgress: setProgress, recheck: cleared });
      if (result.files.length === 0) setError(L('Download failed. Check your connection and try again.', 'تعذّر التنزيل. تحقق من الاتصال وحاول مرة أخرى.'));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(L('Remove the offline copy of this route from this device?', 'حذف النسخة المحفوظة لهذا المسار من الجهاز؟'))) return;
    await removeRoute(key);
  };

  const pill = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all';
  const offlineBadge = !online && (
    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-500 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0">
      <WifiOff className="w-3.5 h-3.5" />
      {L('Offline', 'غير متصل بالإنترنت')}
    </span>
  );

  let body: React.ReactNode;
  if (progress) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    body = (
      <div className="flex items-center gap-3 w-full max-w-xs" role="status" aria-live="polite">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">
            <span>{L('Downloading', 'جاري التنزيل')}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-chalk rounded-full overflow-hidden border border-sand/40">
            <div className="h-full bg-nile transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={() => abortRef.current?.abort()} className="p-2 rounded-lg text-stone-400 hover:text-ink" aria-label={L('Cancel', 'إلغاء')}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  } else if (!savedRoute) {
    body = (
      <button onClick={start} disabled={!online} className={`${pill} ${online ? 'bg-white border border-sand hover:border-nile text-ink shadow-sm group' : 'opacity-50 cursor-not-allowed bg-chalk text-stone-400'}`}>
        <Download className="w-4 h-4 text-stone-400 group-hover:text-nile transition-colors" />
        {L('Download for offline', 'تنزيل للاستخدام دون إنترنت')}
      </button>
    );
  } else {
    const upToDate = missing.length === 0 && !cleared;
    body = (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={`${pill} bg-nile/10 text-nile`}>
          <CheckCircle className="w-4 h-4" />
          {L('Available offline', 'متاح دون إنترنت')} · {formatSize(savedRoute.bytes, ar)}
        </span>
        {!upToDate && (
          <button onClick={start} disabled={!online} className={`${pill} bg-white border border-gold/60 text-ink shadow-sm hover:border-nile disabled:opacity-50`}>
            <RefreshCw className="w-4 h-4 text-gold" />
            {retryOnly && !cleared
              ? byLang({
                  en: `Retry (${missingAudio ? `${missingAudio} audio` : missing.length} missing)`,
                  ar: `إعادة المحاولة (${missingAudio || missing.length} ناقصة)`,
                  fr: `Réessayer (${missingAudio ? `${missingAudio} audio` : missing.length} manquant${(missingAudio || missing.length) > 1 ? 's' : ''})`,
                  es: `Reintentar (faltan ${missingAudio ? `${missingAudio} audios` : missing.length})`,
                })
              : L('Update offline copy', 'تحديث النسخة المحفوظة')}
          </button>
        )}
        <button onClick={remove} className="p-2.5 rounded-xl text-stone-400 hover:text-red-700 hover:bg-red-50" aria-label={L('Remove offline copy', 'حذف النسخة المحفوظة')} title={L('Remove offline copy', 'حذف النسخة المحفوظة')}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {offlineBadge}
        {body}
      </div>
      {!progress && !savedRoute && (
        <p className="text-[11px] text-stone-400">
          {L('Audio guides, photos and map, so the walk works with no signal.', 'الأدلة الصوتية والصور والخريطة، لتعمل دون اتصال.')}
        </p>
      )}
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
