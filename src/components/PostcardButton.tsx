import React, { useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Route } from '../data/locations';
import { photoForRoute } from '../data/photo-resolve';
import { formatDistance } from '../lib/geo';
import { makePostcard } from '../lib/postcard';
import { routeShareUrl } from '../lib/share';
import type { WalkSummary } from '../lib/walk-summary';
import { L, currentLang, nameOf } from '../i18n/lang';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = 'Inter, system-ui, sans-serif';
const ARABIC = 'Cairo, Tahoma, sans-serif';

/** Waits (briefly) for the fonts the card uses, so it isn't drawn in a fallback. */
async function fontsReady(families: string[]) {
  if (!document.fonts?.load) return;
  const loads = families.map(f => document.fonts.load(`700 48px ${f}`).catch(() => []));
  await Promise.race([Promise.all(loads), new Promise(r => setTimeout(r, 1500))]);
}

/**
 * "Share a postcard": a square image of the finished walk (photo, route, stops,
 * distance, time), made on this device and shared through the phone's share
 * sheet, or downloaded where files can't be shared. Nothing is uploaded.
 */
export function PostcardButton({ route, summary, title }: { route: Route; summary: WalkSummary; title: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const ar = currentLang() === 'ar';

  const make = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const sans = ar ? ARABIC : SANS;
      await fontsReady(ar ? [ARABIC] : [SERIF, SANS]);
      const stats = [
        `${summary.visited}/${summary.total} ${L('stops', 'محطات')}`,
        summary.meters ? `≈ ${formatDistance(summary.meters, ar)}` : '',
        summary.minutes ? `≈ ${summary.minutes} ${L('min walking', 'دقيقة مشي')}` : '',
      ].filter(Boolean).join(' · ');
      const blob = await makePostcard(
        { title, route: nameOf(route), stats, brand: ar ? 'Cairo Walks · جولات القاهرة' : 'Cairo Walks', rtl: ar, serif: SERIF, sans },
        photoForRoute(route)?.src,
      );
      const file = new File([blob], `cairo-walks-${route.id}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: nameOf(route), text: routeShareUrl(window.location.origin, route.id) });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') throw err;
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setMessage({ text: L('Postcard saved to your downloads.', 'تم حفظ البطاقة في التنزيلات.'), error: false });
      }
    } catch {
      setMessage({ text: L("The postcard couldn't be made on this device.", 'تعذر إنشاء البطاقة على هذا الجهاز.'), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={make}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-sand text-ink text-xs font-bold uppercase tracking-widest hover:border-nile disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="w-4 h-4" aria-hidden="true" />}
        {busy ? L('Making your postcard…', 'جارٍ إنشاء البطاقة…') : L('Share a postcard', 'شارك بطاقة الجولة')}
      </button>
      {message && <p className={`mt-1 text-xs ${message.error ? 'text-red-700' : 'text-nile'}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
