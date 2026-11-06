// Small pieces shared by the route's download button and the Offline sheet.

import { useEffect, useState } from 'react';
import { NOTHING_SAVED } from '../lib/offline-downloads';
import { L } from '../i18n/lang';

export const useOnline = () => {
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

export const formatSize = (bytes: number, ar: boolean) => {
  const mb = bytes / (1024 * 1024);
  const value = mb >= 10 ? Math.round(mb).toString() : mb.toFixed(1);
  return ar ? `${value} ميجابايت` : `${value} ${L('MB', 'ميجابايت')}`;
};

/** "Download failed…" for a download that saved nothing, else the error itself. */
export const downloadError = (e: string) => (e === NOTHING_SAVED ? L('Download failed. Check your connection and try again.', 'تعذّر التنزيل. تحقق من الاتصال وحاول مرة أخرى.') : e);

