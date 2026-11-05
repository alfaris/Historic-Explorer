import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour for a modal dialog: moves focus into it when it opens,
 * keeps Tab inside it, closes it on Escape, and puts focus back where it was
 * when it closes. Attach the returned ref to the dialog panel.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    // Tab order inside a dialog isn't a simple list (a radio group is one Tab
    // stop, for example), so rather than predict it, catch focus leaving the
    // dialog and bring it back to the far end it would have wrapped to.
    let backwards = false;
    const focusables = () => [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(el => el.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      } else if (e.key === 'Tab') {
        backwards = e.shiftKey;
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!panel || panel.contains(e.target as Node)) return;
      const items = focusables();
      (backwards ? items[items.length - 1] : items[0])?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      previous?.focus?.();
    };
  }, []);

  /**
   * Props for the two invisible focus guards placed just before and just after
   * the panel. Without them, Tab from the last control of a dialog at the end
   * of the page leaves the page entirely (into the browser), where no event can
   * bring it back.
   */
  const guard = (at: 'start' | 'end') => ({
    tabIndex: 0,
    'aria-hidden': true as const,
    onFocus: () => {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(el => el.offsetParent !== null);
      (at === 'start' ? items[items.length - 1] : items[0])?.focus();
    },
  });

  return { ref, guard };
}
