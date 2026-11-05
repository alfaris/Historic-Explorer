// Calls to /api/admin. State-changing calls carry the admin header, which the
// server requires (see api/_lib/admin-auth.ts).

import type { Content } from '../data/content';

export interface Report {
  id: string;
  createdAt: string;
  status: 'open' | 'resolved' | 'dismissed';
  type: 'location' | 'text' | 'closed' | 'photo';
  placeId: number;
  placeName: string;
  message: string;
  suggested?: { lat: number; lng: number; source: 'gps' | 'map'; accuracy?: number };
  lang: 'en' | 'ar';
  adminNote?: string;
  updatedAt?: string;
}

export interface HistoryEntry {
  pathname: string;
  savedAt: string;
  size: number;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public problems: string[] = []) {
    super(message);
  }
}

async function call<T>(action: string, init: RequestInit = {}, query = ''): Promise<T> {
  const res = await fetch(`/api/admin?action=${action}${query}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-cairo-walks-admin': '1', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.problems ?? []);
  return data as T;
}

export const api = {
  session: () => call<{ configured: boolean; signedIn: boolean }>('session'),
  login: (password: string) => call<{ ok: true }>('login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<{ ok: true }>('logout', { method: 'POST' }),
  content: () => call<{ content: Content; etag: string | null }>('content'),
  saveContent: (content: Content, etag: string | null, note: string) =>
    call<{ etag: string }>('content', { method: 'PUT', body: JSON.stringify({ content, etag, note }) }),
  reports: () => call<{ reports: Report[] }>('reports'),
  updateReport: (id: string, changes: { status?: Report['status']; adminNote?: string }) =>
    call<{ report: Report }>('report', { method: 'PATCH', body: JSON.stringify({ id, ...changes }) }),
  history: () => call<{ history: HistoryEntry[] }>('history'),
  /** Uploads an already resized image; returns where it's served. */
  uploadPhoto: async (image: Blob, width: number, height: number) => {
    const res = await fetch(`/api/admin?action=photo&width=${width}&height=${height}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': image.type, 'x-cairo-walks-admin': '1' },
      body: image,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `Upload failed (${res.status})`, res.status);
    return data as { src: string; width: number; height: number };
  },
  version: (pathname: string) => call<{ content: Content & { note?: string } }>('version', {}, `&pathname=${encodeURIComponent(pathname)}`),
};
