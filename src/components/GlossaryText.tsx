import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useContent } from '../data/ContentContext';
import { glossaryOf } from '../data/content';
import { glossarySegments, glossaryText, type GlossaryTerm } from '../lib/glossary';
import { L, LANGUAGES, currentLang } from '../i18n/lang';

const GUTTER = 16;

/**
 * A glossary term in a description: a dotted underline that opens a small
 * explanation. It's a disclosure button (aria-expanded), and the explanation
 * is announced when it opens. Escape, a tap outside or scrolling closes it.
 */
function Term({ text, term }: { text: string; term: GlossaryTerm }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  // Where the explanation is drawn: inside a modal that marks itself as a host
  // (walk mode), so its focus trap and screen readers include it; else the page.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const id = useId();
  const lang = currentLang();
  const { term: name, def } = glossaryText(term, lang);

  // Place it under the word (above it near the bottom of the screen), inside the screen's edges.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const width = Math.min(320, vw - GUTTER * 2);
    const left = Math.max(GUTTER, Math.min(r.left + r.width / 2 - width / 2, vw - GUTTER - width));
    // Measure at the final width: a narrower panel wraps onto more lines.
    if (panel.current) panel.current.style.width = `${width}px`;
    const height = panel.current?.offsetHeight ?? 120;
    const below = r.bottom + 8;
    const top = below + height > window.innerHeight - GUTTER && r.top - 8 - height > GUTTER ? r.top - 8 - height : below;
    setPos({ left, top, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Close this, not the dialog it sits in (walk mode).
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={e => {
          e.stopPropagation();
          setHost(e.currentTarget.closest<HTMLElement>('[data-portal-host]') ?? document.body);
          setOpen(o => !o);
        }}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="inline p-0 m-0 bg-transparent border-0 font-[inherit] text-[inherit] underline decoration-dotted decoration-gold decoration-2 underline-offset-4 cursor-help hover:text-nile focus-visible:outline-2 focus-visible:outline-nile rounded-sm"
        style={{ fontStyle: 'inherit', lineHeight: 'inherit' }}
      >
        {text}
      </button>
      {open &&
        host &&
        createPortal(
          <span
            ref={panel}
            id={id}
            role="note"
            aria-live="polite"
            dir={LANGUAGES[lang].dir}
            onClick={e => e.stopPropagation()}
            className="fixed z-[7200] block rounded-2xl border border-sand bg-white p-4 pe-10 text-start not-italic shadow-xl"
            style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: 'hidden', left: 0, top: 0 }}
          >
            <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-ink">
              <span lang={name.lang}>{name.text}</span>
              {lang !== 'ar' && term.termAr && (
                <span lang="ar" dir="rtl" className="font-arabic font-normal text-stone-500">{term.termAr}</span>
              )}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-stone-600 font-sans" lang={def.lang}>{def.text}</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              className="absolute top-1.5 end-1.5 flex items-center justify-center min-h-11 min-w-11 rounded-full text-stone-400 hover:text-ink"
              aria-label={L('Close', 'إغلاق')}
            >
              <X className="w-4 h-4" />
            </button>
          </span>,
          host,
        )}
    </>
  );
}

/** A description with its glossary terms linked (the first use of each). */
export function GlossaryText({ text }: { text: string }) {
  const content = useContent();
  const segments = useMemo(() => glossarySegments(text, glossaryOf(content)), [text, content]);
  return (
    <>
      {segments.map((s, i) => (typeof s === 'string' ? <React.Fragment key={i}>{s}</React.Fragment> : <Term key={i} text={s.text} term={s.term} />))}
    </>
  );
}
