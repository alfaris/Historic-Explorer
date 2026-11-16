import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { MAX_GALLERY } from '../data/content';
import type { GalleryPhoto } from '../data/locations';
import { api } from './api';
import { Button, Field, inputClass } from './ui';
import { LICENSES, prepareImage } from './PhotoField';
import { PhotoAltFields } from './PhotoAltFields';
import { addToGallery, fillGalleryAlts, moveInGallery, removeFromGallery, updateInGallery } from './gallery';

/**
 * "More photos" in the place editor: up to MAX_GALLERY uploads besides the
 * main photo, in order, each with its credit and what it shows. Changes are
 * saved with the form.
 */
export function GalleryEditor({ gallery, name, onChange }: {
  gallery: GalleryPhoto[];
  name: string;
  /** Given a function of the latest gallery, so an upload or Gemini answer arriving late can't undo other edits. */
  onChange: (update: (gallery: GalleryPhoto[]) => GalleryPhoto[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = gallery.length >= MAX_GALLERY;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { blob, width, height } = await prepareImage(file);
      const { src } = await api.uploadPhoto(blob, width, height);
      onChange(g => addToGallery(g, { src, width, height, author: '', license: 'Own photo', licenseUrl: null, sourceUrl: '' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-sand/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-stone-600 me-auto">More photos (optional, up to {MAX_GALLERY})</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          aria-label="Choose a photo to add"
          onChange={e => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy || full} className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4" aria-hidden="true" />
          {busy ? 'Uploading…' : full ? `${MAX_GALLERY} photos (the most)` : 'Add a photo'}
        </Button>
      </div>
      <p className="text-[11px] text-stone-400">Shown after the description, to swipe through: the courtyard, the inside, a detail. Resized and stripped of location data like the main photo.</p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <ol className="space-y-4">
        {gallery.map((g, i) => (
          <li key={g.src} className="rounded-xl border border-sand/50 p-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <img src={g.src} alt="" className="sm:w-40 w-full aspect-[4/3] object-cover rounded-lg border border-sand/50 bg-chalk" />
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-stone-500 me-auto">Photo {i + 2}</span>
                  <Button type="button" variant="secondary" className="!py-1.5 !px-2" onClick={() => onChange(list => moveInGallery(list, i, -1))} disabled={i === 0} aria-label={`Move photo ${i + 2} earlier`}>
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="secondary" className="!py-1.5 !px-2" onClick={() => onChange(list => moveInGallery(list, i, 1))} disabled={i === gallery.length - 1} aria-label={`Move photo ${i + 2} later`}>
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="danger" className="!py-1.5 !px-2" onClick={() => onChange(list => removeFromGallery(list, i))} aria-label={`Remove photo ${i + 2}`}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Photo by">
                    <input value={g.author} onChange={e => onChange(list => updateInGallery(list, i, { author: e.target.value }))} className={inputClass} maxLength={120} required />
                  </Field>
                  <Field label="License">
                    <input value={g.license} onChange={e => onChange(list => updateInGallery(list, i, { license: e.target.value }))} className={inputClass} list={`gallery-licenses-${i}`} maxLength={80} required />
                    <datalist id={`gallery-licenses-${i}`}>
                      {LICENSES.map(l => <option key={l} value={l} />)}
                    </datalist>
                  </Field>
                </div>
              </div>
            </div>
            <PhotoAltFields
              item={g}
              src={g.src}
              name={name}
              onChange={(key, value) => onChange(list => updateInGallery(list, i, { [key]: value }))}
              onDraft={texts => onChange(list => fillGalleryAlts(list, i, g.src, texts))}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
