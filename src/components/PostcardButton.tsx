import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Route } from '../data/locations';
import { photoForRoute } from '../data/photo-resolve';
import { formatDistance } from '../lib/geo';
import { makePostcard, photoCredit } from '../lib/postcard';
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
  // A made card the browser wouldn't share (the tap had "expired" while it was drawn): share on the next tap.
  const [pending, setPending] = useState<File | null>(null);
  const ar = currentLang() === 'ar';
  const photo = photoForRoute(route);
  const credit = photo ? photoCredit(photo, L('Photo', 'الصورة')) : undefined;
  const shareText = [routeShareUrl(window.location.origin, route.id), credit].filter(Boolean).join('\n');

  const build = async () => {
    const sans = ar ? ARABIC : SANS;
    await fontsReady(ar ? [ARABIC] : [SERIF, SANS]);
    const stats = [
      `${summary.visited}/${summary.total} ${L('stops', 'محطات')}`,
      summary.meters ? `≈ ${formatDistance(summary.meters, ar)}` : '',
      summary.minutes ? `≈ ${summary.minutes} ${L('min walking', 'دقيقة مشي')}` : '',
    ].filter(Boolean).join(' · ');
    const blob = await makePostcard(
      { title, route: nameOf(route), stats, brand: ar ? 'Cairo Walks · جولات القاهرة' : 'Cairo Walks', rtl: ar, serif: SERIF, sans, credit },
      photo?.src,
    );
    return new File([blob], `cairo-walks-${route.id}.jpg`, { type: 'image/jpeg' });
  };

  // Made as soon as the finish screen opens, so a tap can share it at once:
  // browsers only allow sharing straight after a tap, and drawing the card
  // (loading the photo on a slow connection) can take longer than that.
  const ready = useRef<Promise<File> | null>(null);
  const key = `${route.id}|${title}|${summary.visited}|${summary.meters}|${currentLang()}`;
  useEffect(() => {
    const p = build();
    p.catch(() => {});
    ready.current = p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const download = (file: File) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    setMessage({ text: L('Postcard saved to your downloads.', 'تم حفظ البطاقة في التنزيلات.'), error: false });
  };

  const share = async (file: File) => {
    if (!navigator.canShare?.({ files: [file] })) return download(file);
    try {
      await navigator.share({ files: [file], title: nameOf(route), text: shareText });
      setPending(null);
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'AbortError') return;
      // The tap no longer counts (or sharing was refused): keep the card for a second tap.
      if (name === 'NotAllowedError') {
        setPending(file);
        setMessage({ text: L('Your postcard is ready. Tap Share now to send it.', 'بطاقتك جاهزة. اضغط «شارك الآن» لإرسالها.'), error: false });
        return;
      }
      throw err;
    }
  };

  const make = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const file = await (ready.current ?? build()).catch(() => build());
      await share(file);
    } catch {
      setMessage({ text: L("The postcard couldn't be made on this device.", 'تعذر إنشاء البطاقة على هذا الجهاز.'), error: true });
    } finally {
      setBusy(false);
    }
  };

  const button = 'flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl border border-sand text-ink text-xs font-bold uppercase tracking-widest hover:border-nile disabled:opacity-60';
  return (
    <div className="space-y-2">
      {pending ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => share(pending).catch(() => download(pending))} className={`${button} flex-1`}>
            <ImageIcon className="w-4 h-4" aria-hidden="true" /> {L('Share now', 'شارك الآن')}
          </button>
          <button type="button" onClick={() => download(pending)} className={`${button} !w-auto`}>
            {L('Save image', 'احفظ الصورة')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={make} disabled={busy} className={button}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="w-4 h-4" aria-hidden="true" />}
          {busy ? L('Making your postcard…', 'جارٍ إنشاء البطاقة…') : L('Share a postcard', 'شارك بطاقة الجولة')}
        </button>
      )}
      {message && <p className={`text-xs ${message.error ? 'text-red-700' : 'text-nile'}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
