import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import type { Route } from '../data/content';
import { routeShareUrl } from '../lib/share';
import { Button } from './ui';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A QR code that opens the app on this route, to download or print as a card. */
export function RouteQr({ route }: { route: Route }) {
  const url = routeShareUrl(window.location.origin, route.id);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // High error correction, so a creased or partly covered print still scans.
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 1, color: { dark: '#1a4d3b', light: '#ffffff' } }).then(s => active && setSvg(s));
    return () => {
      active = false;
    };
  }, [url]);

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg!], { type: 'image/svg+xml' }));
    a.download = `cairo-walks-${route.id}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // A printable card: the route's name in English and Arabic, the QR code and the link.
  const print = () => {
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(route.nameEn)}: QR card</title>
<style>
  @page { size: A5; margin: 12mm; }
  body { font-family: system-ui, sans-serif; color: #1a1a1a; text-align: center; margin: 0; padding: 24px; }
  .brand { letter-spacing: .25em; text-transform: uppercase; font-size: 11px; color: #86672a; font-weight: 700; }
  h1 { font-family: Georgia, serif; font-weight: 400; font-size: 28px; margin: 8px 0 2px; }
  h2 { font-weight: 700; font-size: 24px; margin: 0 0 16px; }
  .qr svg { width: 70mm; height: 70mm; }
  p { margin: 6px 0; font-size: 14px; }
  .url { font-size: 11px; color: #555; word-break: break-all; margin-top: 12px; }
</style></head><body>
  <div class="brand">Cairo Walks</div>
  <h1>${escapeHtml(route.nameEn)}</h1>
  <h2 dir="rtl" lang="ar">${escapeHtml(route.nameAr)}</h2>
  <div class="qr">${svg}</div>
  <p>Scan to start the walk, with audio guides that work offline.</p>
  <p dir="rtl" lang="ar">امسح الرمز لبدء الجولة، مع أدلة صوتية تعمل دون إنترنت.</p>
  <div class="url">${escapeHtml(url)}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div>
      <p className="text-xs font-bold text-stone-600 mb-1">QR code</p>
      <p className="text-[11px] text-stone-400 mb-2">Opens the app on this route, for example on a card at a hotel desk. Links also share as <span className="font-mono">{url}</span>.</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-32 h-32 rounded-xl border border-sand/60 p-1 bg-white [&>svg]:w-full [&>svg]:h-full" aria-label={`QR code for ${route.nameEn}`} role="img" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" onClick={print} disabled={!svg} className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print card
          </Button>
          <Button type="button" variant="secondary" onClick={download} disabled={!svg} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Download SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
