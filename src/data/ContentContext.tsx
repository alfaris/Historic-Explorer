import React, { createContext, useContext, useEffect, useState } from 'react';
import { bundledContent, normalizeContent, validateContent, type Content } from './content';

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
        // Keep the bundled copy if the response is somehow unusable.
        if (validateContent(live).length === 0) setContent(live);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);
