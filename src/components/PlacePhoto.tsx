import React, { useState } from 'react';
import type { Photo } from '../data/photos';
import { smallPhotoSrc } from '../data/photo-resolve';

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
}

export function PlacePhoto({ photo, alt, className = '', fallback, showCredit = false, sizes = '100vw', priority = false }: PlacePhotoProps) {
  // Remember which photo failed, not just that one did: the same component is
  // reused when another place is selected, and that photo should still load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!photo || failedSrc === photo.src) return <>{fallback}</>;
  const small = smallPhotoSrc(photo.src);

  return (
    <div className={`relative overflow-hidden bg-sand/30 ${className}`}>
      <img
        src={photo.src}
        srcSet={small ? `${small} 480w, ${photo.src} ${photo.width}w` : undefined}
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
