import React, { createContext, useContext, useEffect, useState } from 'react';
import { bundledContent, isUsableContent, normalizeContent, type Content } from './content';

const ContentContext = createContext<Content>(bundledContent);

/**
 * Serves the live routes and places. Starts with the bundled copy so the app
 * renders instantly (and offline), then switches to /api/content once it
 * arrives. The service worker keeps the last copy for offline use.
 */
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<Content>(bundledContent);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/content')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const live = normalizeContent(data);
        // Keep the bundled copy only if the response can't be shown at all. Content that
        // fails a check added since it was saved is still shown (the admin is asked to fix it).
        if (isUsableContent(live)) setContent(live);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);

/** Serves the given content instead: the admin's place preview, with the unsaved draft in it. */
export function ContentValue({ value, children }: { value: Content; children: React.ReactNode }) {
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
