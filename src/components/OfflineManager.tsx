import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Download, HardDrive, RefreshCw, Trash2, X } from 'lucide-react';
import { useContent } from '../data/ContentContext';
import { routePack } from '../lib/offline-pack';
import { missingFiles, offlineSupported, removeRoute, savedRouteKey, useOfflineRoutes } from '../lib/offline-store';
import { cancelAll, cancelDownload, downloadAll, startDownload, useDownloads } from '../lib/offline-downloads';
import { useDialog } from '../lib/useDialog';
import { L, byLang, currentLang, nameOf } from '../i18n/lang';
import { downloadError, formatSize, useOnline } from './offline-ui';

/** "2.1 GB" or "340 MB". */
const formatSpace = (bytes: number, ar: boolean) => {
  const gb = bytes / 1024 ** 3;
  if (gb < 1) return formatSize(bytes, ar);
  const value = gb >= 10 ? Math.round(gb).toString() : gb.toFixed(1);
  return ar ? `${value} جيجابايت` : `${value} GB`;
};

/** How much space the app uses and the browser has left, and whether downloads are protected from clean-up. */
function useStorage(deps: unknown) {
  const [info, setInfo] = useState<{ used: number; free: number; persisted: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const storage = navigator.storage;
    if (!storage?.estimate) return;
    Promise.all([storage.estimate(), storage.persisted?.().catch(() => false) ?? Promise.resolve(false)])
      .then(([e, persisted]) => {
        if (active && e.quota) setInfo({ used: e.usage ?? 0, free: Math.max(0, e.quota - (e.usage ?? 0)), persisted: !!persisted });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deps]);
  return info;
}

function Sheet({ onClose }: { onClose: () => void }) {
  const { routes, places } = useContent();
  const lang = currentLang();
  const ar = lang === 'ar';
  const online = useOnline();
  const saved = useOfflineRoutes();
  const downloads = useDownloads();
  const { ref, guard } = useDialog<HTMLDivElement>(onClose);

  const items = useMemo(
    () =>
      routes.map(route => {
        const key = savedRouteKey(route.id, lang);
        const needed = routePack(route, places.filter(p => p.routeId === route.id), lang);
        return { route, key, needed };
      }),
    [routes, places, lang],
  );
  const rows = items.map(item => {
    const savedRoute = saved[item.key];
    const missing = missingFiles(savedRoute, item.needed);
    const state = !savedRoute ? 'none' : missing.length ? 'update' : 'saved';
    return { ...item, savedRoute, state } as const;
  });
  const total = rows.reduce((n, r) => n + (r.savedRoute?.bytes ?? 0), 0);
  const allDone = rows.every(r => r.state === 'saved');
  const storage = useStorage(total);

  const all = downloads.all;
  const current = all ? rows[all.index] : null;
  const currentProgress = current ? downloads.progress[current.key] : null;
  const pct = currentProgress?.total ? Math.round((currentProgress.done / currentProgress.total) * 100) : 0;

  const remove = async (key: string) => {
    if (!window.confirm(L('Remove the offline copy of this route from this device?', 'حذف النسخة المحفوظة لهذا المسار من الجهاز؟'))) return;
    await removeRoute(key);
  };

  return createPortal(
    <div className="fixed inset-0 z-[7100] flex items-end sm:items-center justify-center bg-ink/50 p-0 sm:p-4" onClick={onClose}>
      <span {...guard('start')} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-sand/50 px-5 pt-5 pb-4 space-y-3">
          <button
            onClick={onClose}
            className="absolute top-3 end-3 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-500 hover:text-ink"
            aria-label={L('Close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
          <h2 id="offline-title" className={`text-2xl text-ink pe-10 ${ar ? 'font-arabic font-bold' : 'font-serif'}`}>{L('Offline routes', 'المسارات دون إنترنت')}</h2>
          <p className="text-xs text-stone-500">{L('Audio is saved in the current language.', 'تُحفظ الأدلة الصوتية باللغة الحالية.')}</p>

          {all ? (
            <div className="flex items-center gap-3" role="status" aria-live="polite">
              <div className="flex-1">
                <div className="flex justify-between gap-2 text-xs font-bold text-stone-600 mb-1">
                  <span className="truncate">
                    {byLang({
                      en: `Downloading ${all.index + 1} of ${all.count}`,
                      ar: `جاري تنزيل ${all.index + 1} من ${all.count}`,
                      fr: `Téléchargement ${all.index + 1} sur ${all.count}`,
                      es: `Descargando ${all.index + 1} de ${all.count}`,
                    })}
                    {current && ` · ${nameOf(current.route)}`}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-chalk rounded-full overflow-hidden border border-sand/40">
                  <div className="h-full bg-nile transition-all" style={{ width: `${((all.index + pct / 100) / all.count) * 100}%` }} />
                </div>
              </div>
              <button onClick={cancelAll} className="min-h-11 px-3 rounded-xl text-xs font-bold uppercase tracking-widest text-stone-600 hover:text-ink">
                {L('Cancel', 'إلغاء')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => downloadAll(items.map(({ key, needed }) => ({ key, needed })))}
              disabled={!online || allDone}
              className="flex w-full items-center justify-center gap-2 min-h-12 rounded-2xl bg-nile text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50"
            >
              {allDone ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
              {allDone ? L('Available offline', 'متاح دون إنترنت') : L('Download all', 'تنزيل الكل')}
            </button>
          )}
        </div>

        <ul className="px-5 py-3 divide-y divide-sand/40">
          {rows.map(row => {
            const progress = downloads.progress[row.key];
            const error = downloads.errors[row.key];
            const pctRow = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
            return (
              <li key={row.key} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink truncate">{nameOf(row.route)}</span>
                    <span className={`block text-xs ${row.state === 'saved' ? 'text-nile' : row.state === 'update' ? 'text-amber-800' : 'text-stone-500'}`}>
                      {progress
                        ? `${L('Downloading', 'جاري التنزيل')} ${pctRow}%`
                        : row.state === 'none'
                          ? L('Not saved', 'غير محفوظ')
                          : `${row.state === 'update' ? L('Update available', 'يتوفر تحديث') : L('Available offline', 'متاح دون إنترنت')} · ${formatSize(row.savedRoute!.bytes, ar)}`}
                    </span>
                  </span>
                  {progress ? (
                    <button onClick={() => cancelDownload(row.key)} className="flex items-center justify-center min-h-11 min-w-11 rounded-xl text-stone-500 hover:text-ink" aria-label={`${L('Cancel', 'إلغاء')}: ${nameOf(row.route)}`}>
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      {row.state !== 'saved' && (
                        <button
                          onClick={() => startDownload(row.key, row.needed)}
                          disabled={!online || !!all}
                          className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-sand text-xs font-bold text-ink hover:border-nile disabled:opacity-50"
                          aria-label={`${row.state === 'update' ? L('Update', 'تحديث') : L('Download', 'تنزيل')}: ${nameOf(row.route)}`}
                        >
                          {row.state === 'update' ? <RefreshCw className="w-4 h-4 text-gold" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                          <span aria-hidden="true">{row.state === 'update' ? L('Update', 'تحديث') : L('Download', 'تنزيل')}</span>
                        </button>
                      )}
                      {row.savedRoute && (
                        <button
                          onClick={() => remove(row.key)}
                          disabled={!!all}
                          className="flex items-center justify-center min-h-11 min-w-11 rounded-xl text-stone-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`${L('Remove', 'إزالة')}: ${nameOf(row.route)}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
                {error && <p className="mt-1 text-xs text-red-700" role="alert">{downloadError(error)}</p>}
              </li>
            );
          })}
        </ul>

        {storage && (
          <div className="px-5 pb-5 pt-1 text-xs text-stone-600 space-y-1">
            <p className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 shrink-0 text-stone-500" aria-hidden="true" />
              {byLang({
                en: `Using ${formatSpace(storage.used, ar)} · about ${formatSpace(storage.free, ar)} free`,
                ar: `المستخدم ${formatSpace(storage.used, ar)} · المتاح نحو ${formatSpace(storage.free, ar)}`,
                fr: `${formatSpace(storage.used, ar)} utilisés · environ ${formatSpace(storage.free, ar)} libres`,
                es: `${formatSpace(storage.used, ar)} en uso · unos ${formatSpace(storage.free, ar)} libres`,
              })}
            </p>
            {storage.persisted && <p className="ps-6">{L('Kept on this device even when space runs low.', 'تبقى محفوظة على هذا الجهاز حتى عند نقص المساحة.')}</p>}
          </div>
        )}
      </div>
      <span {...guard('end')} />
    </div>,
    document.body,
  );
}

/** "Offline routes": every route's offline copy in one place, with "Download all". */
export function OfflineManager() {
  const [open, setOpen] = useState(false);
  if (!offlineSupported()) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="min-h-11 px-3 text-xs font-bold text-nile underline underline-offset-4 hover:no-underline">
        {L('Offline routes', 'المسارات دون إنترنت')}
      </button>
      {open && <Sheet onClose={() => setOpen(false)} />}
    </>
  );
}
