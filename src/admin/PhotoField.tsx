import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Photo } from '../data/photos';
import { api } from './api';
import { Button, Field, inputClass } from './ui';

const MAX_WIDTH = 960;
const MAX_HEIGHT = 1600;

/**
 * Resizes a photo in the browser before upload: at most 960px wide, WebP
 * (JPEG where the browser can't make WebP). Re-encoding also drops the
 * file's metadata, including any GPS position a phone stored in it.
 */
async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  let blob = await encode('image/webp', 0.78);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.82);
  if (!blob) throw new Error('This image couldn’t be processed.');
  return { blob, width, height };
}

const LICENSES = ['Own photo', 'Used with permission', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Public domain'];

/** The photo section of the place and route editors. Changes are saved with the form. */
export function PhotoField({ photo, builtIn, onChange }: {
  photo: Photo | undefined;
  builtIn: Photo | undefined;
  onChange: (photo: Photo | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = photo ?? builtIn;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { blob, width, height } = await prepareImage(file);
      const { src } = await api.uploadPhoto(blob, width, height);
      onChange({
        src,
        width,
        height,
        author: photo?.author ?? '',
        license: photo?.license ?? 'Own photo',
        licenseUrl: photo?.licenseUrl ?? null,
        sourceUrl: photo?.sourceUrl ?? '',
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const set = <K extends keyof Photo>(key: K, value: Photo[K]) => photo && onChange({ ...photo, [key]: value });

  return (
    <div>
      <p className="text-xs font-bold text-stone-500 mb-2">Photo</p>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:w-56 shrink-0">
          {shown ? (
            <img src={shown.src} alt="" className="w-full aspect-[4/3] object-cover rounded-xl border border-sand/50 bg-chalk" />
          ) : (
            <div className="w-full aspect-[4/3] rounded-xl border border-dashed border-sand flex items-center justify-center text-xs text-stone-400">No photo</div>
          )}
          <p className="text-[11px] text-stone-400 mt-1">
            {photo ? 'Uploaded photo' : builtIn ? 'Built-in photo (Wikimedia Commons)' : 'Shows the illustrated placeholder'}
          </p>
        </div>
        <div className="flex-1 space-y-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            aria-label="Choose a photo"
            onChange={e => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy} className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4" />
              {busy ? 'Uploading…' : photo || builtIn ? 'Replace photo' : 'Upload photo'}
            </Button>
            {photo && (
              <Button type="button" variant="danger" onClick={() => onChange(undefined)} disabled={busy}>
                {builtIn ? 'Remove (use built-in)' : 'Remove photo'}
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {photo && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Photo by" hint="Shown on the photo and in Photo credits.">
                <input value={photo.author} onChange={e => set('author', e.target.value)} className={inputClass} maxLength={120} required />
              </Field>
              <Field label="License">
                <input value={photo.license} onChange={e => set('license', e.target.value)} className={inputClass} list="photo-licenses" maxLength={80} required />
                <datalist id="photo-licenses">
                  {LICENSES.map(l => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <Field label="Source link (optional)" hint="https:// address of the original, if any.">
                <input value={photo.sourceUrl} onChange={e => set('sourceUrl', e.target.value)} className={inputClass} type="url" placeholder="https://" />
              </Field>
              <Field label="License link (optional)">
                <input value={photo.licenseUrl ?? ''} onChange={e => set('licenseUrl', e.target.value || null)} className={inputClass} type="url" placeholder="https://" />
              </Field>
            </div>
          )}
          {photo && <p className="text-[11px] text-stone-400">Photos are resized to 960px wide and their location data is removed before upload. Click Save to publish.</p>}
        </div>
      </div>
    </div>
  );
}
