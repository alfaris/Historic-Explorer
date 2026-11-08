import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { Photo } from '../data/photos';
import { smallPhotoSrc, thumbPhotoSrc } from '../data/photo-resolve';
import { useDisplay } from '../lib/display';
import { L } from '../i18n/lang';

// Photos the visitor chose to see with the data saver on, for the rest of the visit.
const revealed = new Set<string>();

/** Whether any size of a photo is already on the device (a route saved offline, or seen before). */
const isCached = async (src: string) => {
  if (typeof caches === 'undefined') return false;
  for (const url of [src, smallPhotoSrc(src), thumbPhotoSrc(src)]) {
    if (url && (await caches.match(url).catch(() => undefined))) return true;
  }
  return false;
};

interface PlacePhotoProps {
  photo: Photo | undefined;
  alt: string;
  className?: string;
  /** Shown when there's no photo, or if it fails to load. */
  fallback: React.ReactNode;
  /** Show a small credit line on the photo. */
  showCredit?: boolean;
  /** How wide the photo is shown, for srcset (defaults to the full width of the screen). */
  sizes?: string;
  /** Load straight away (photos visible when the page opens), not lazily. */
  priority?: boolean;
  /**
   * With the data saver on, offer "Show photo" on the placeholder. Off where
   * the photo sits inside another button (list rows, the route picker): those
   * show the placeholder only.
   */
  tapToShow?: boolean;
}

export function PlacePhoto({ photo, alt, className = '', fallback, showCredit = false, sizes = '100vw', priority = false, tapToShow = true }: PlacePhotoProps) {
  // Remember which photo failed, not just that one did: the same component is
  // reused when another place is selected, and that photo should still load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { dataSaver } = useDisplay();
  const src = photo?.src;
  // Data saver: which photo was let through (tapped, or already on the device).
  const [allowed, setAllowed] = useState<string | null>(null);
  useEffect(() => {
    if (!dataSaver || !src || revealed.has(src)) return;
    let active = true;
    isCached(src).then(hit => {
      if (active && hit) setAllowed(src);
    });
    return () => {
      active = false;
    };
  }, [dataSaver, src]);
  if (!photo || failedSrc === photo.src) return <>{fallback}</>;
  if (dataSaver && allowed !== photo.src && !revealed.has(photo.src)) {
    if (!tapToShow) return <>{fallback}</>;
    return (
      // Sized like the photo would be, with the placeholder filling it.
      <div className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 *:w-full *:h-full">{fallback}</div>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            revealed.add(photo.src);
            setAllowed(photo.src);
          }}
          className="absolute inset-0 z-10 m-auto h-fit w-fit inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-white/90 border border-sand text-xs font-bold text-ink shadow-sm hover:border-nile"
        >
          <ImageIcon className="w-4 h-4" aria-hidden="true" />
          {L('Show photo', 'عرض الصورة')}
        </button>
      </div>
    );
  }
  const small = smallPhotoSrc(photo.src);
  const thumb = thumbPhotoSrc(photo.src);

  return (
    <div className={`relative overflow-hidden bg-sand/30 ${className}`}>
      <img
        src={photo.src}
        srcSet={small ? `${thumb} 240w, ${small} 480w, ${photo.src} ${photo.width}w` : undefined}
        sizes={small ? sizes : undefined}
        alt={alt}
        width={photo.width}
        height={photo.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onError={() => setFailedSrc(photo.src)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {showCredit &&
        (photo.sourceUrl ? (
          <a
            href={photo.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-0 inset-x-0 px-3 py-1.5 bg-gradient-to-t from-ink/70 to-transparent text-xs text-white/85 truncate hover:text-white"
            dir="ltr"
          >
            {photo.author} · {photo.license}
          </a>
        ) : (
          <span className="absolute bottom-0 inset-x-0 px-3 py-1.5 bg-gradient-to-t from-ink/70 to-transparent text-xs text-white/85 truncate" dir="ltr">
            {photo.author} · {photo.license}
          </span>
        ))}
    </div>
  );
}
