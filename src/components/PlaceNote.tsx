import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { NOTE_MAX, setNote, useNotes } from '../lib/notes';
import { L } from '../i18n/lang';

/**
 * "My note": a private note on this place, kept on the device and saved as
 * it's typed. A note changed in another tab shows here unless this box is
 * being edited.
 */
export function PlaceNote({ placeId, className = 'mt-4' }: { placeId: number; className?: string }) {
  const stored = useNotes()[String(placeId)] ?? '';
  const [text, setText] = useState(stored);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(stored);
  }, [stored]);
  const id = `note-${placeId}`;
  return (
    <div className={`rounded-2xl border border-sand/60 p-4 ${className}`} onClick={e => e.stopPropagation()}>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500">
        <NotebookPen className="w-4 h-4 text-gold-ink" aria-hidden="true" />
        {L('My note', 'ملاحظتي')}
      </label>
      <textarea
        id={id}
        value={text}
        maxLength={NOTE_MAX}
        rows={2}
        dir="auto"
        onFocus={() => (editing.current = true)}
        onBlur={() => (editing.current = false)}
        onChange={e => {
          setText(e.target.value);
          setNote(placeId, e.target.value);
        }}
        placeholder={L('Only on this phone, e.g. "come back at sunset"', 'على هذا الهاتف فقط، مثلًا: «أعود وقت الغروب»')}
        className="w-full rounded-xl border border-sand bg-white p-2.5 text-sm text-ink placeholder:text-stone-400 focus:border-nile focus:outline-none"
      />
    </div>
  );
}

/** A small note icon for a place's row when it has a note. */
export function NoteMark({ placeId, className = '' }: { placeId: number; className?: string }) {
  const has = !!useNotes()[String(placeId)];
  if (!has) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-stone-500 ${className}`}>
      <NotebookPen className="w-3.5 h-3.5 text-gold-ink" aria-hidden="true" />
      {L('Note', 'ملاحظة')}
    </span>
  );
}
