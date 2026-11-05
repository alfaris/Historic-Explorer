// /api/admin?action=…: everything the admin dashboard does.
//
//   GET  session            → { signedIn, configured }
//   POST login   {password}
//   POST logout
//   GET  content            → { content, etag }
//   PUT  content {content, etag, note}  → { etag } | { problems } (422) | conflict (409)
//   GET  reports?status=open|resolved|dismissed|all&offset=n → { reports, total, counts }
//   PATCH report {id, status?, adminNote?}
//   GET  history            → { history }
//   GET  version {pathname} → { content }
//   POST photo?width=&height= (image body) → { src, width, height }
//   GET  audio?id=n / POST audio {id, lang, version}  (see admin-audio.ts)
//   GET  stats?days=7|30|90 → { total, perDay }  (see stats.ts)
//   POST translate {texts}  → { texts } French drafts, nothing saved  (see translate.ts)
//   GET  digest → { configured, to }   POST digest-test → sends a test email  (see digest.ts)
//
// Everything except session and login requires a signed-in admin.

import {
  adminConfigured,
  checkPassword,
  clearSessionCookie,
  createSessionToken,
  loginRateLimit,
  requireAdmin,
  sessionCookie,
  verifySessionToken,
} from './admin-auth.js';
import { ContentConflictError, getContentWithEtag, listHistory, readHistory, saveContent } from './content.js';
import { json, readJson } from './http.js';
import { listReports, updateReport } from './reports.js';
import { handlePhotoUpload } from './photos.js';
import { handleAdminAudio } from './admin-audio.js';
import { handleTranslate } from './translate.js';
import { readStats } from './stats.js';
import { digestConfigured, sendTestEmail } from './digest.js';
import { normalizeContent, validateContent } from '../../src/data/content.js';

const cookieValue = (request: Request) =>
  request.headers.get('cookie')?.split(';').map(c => c.trim().split('=')).find(([k]) => k === 'cw_admin')?.[1];

export async function handleAdmin(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const method = request.method;

  if (action === 'session' && method === 'GET') {
    return json({ configured: adminConfigured(), signedIn: verifySessionToken(cookieValue(request)) });
  }

  if (action === 'login' && method === 'POST') {
    const limited = loginRateLimit(request);
    if (limited) return limited;
    if (!adminConfigured()) return json({ error: 'Admin is not set up: ADMIN_PASSWORD (12+ characters) is missing.' }, 503);
    const body = await readJson(request, 2_000);
    if (body instanceof Response) return body;
    const attempt = typeof (body as any)?.password === 'string' ? (body as any).password : '';
    if (!checkPassword(attempt)) return json({ error: 'Wrong password.' }, 401);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, createSessionToken()) });
  }

  if (action === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
  }

  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    if (action === 'content' && method === 'GET') {
      return json(await getContentWithEtag());
    }

    if (action === 'content' && method === 'PUT') {
      const body = await readJson(request, 2_000_000);
      if (body instanceof Response) return body;
      const { content: raw, etag, note } = (body ?? {}) as { content?: unknown; etag?: unknown; note?: unknown };
      const content = normalizeContent(raw);
      const problems = validateContent(content);
      if (problems.length) return json({ error: 'The content has problems.', problems }, 422);
      try {
        const saved = await saveContent(content, typeof etag === 'string' ? etag : null, typeof note === 'string' ? note : '');
        return json(saved);
      } catch (err) {
        if (err instanceof ContentConflictError) return json({ error: err.message }, 409);
        throw err;
      }
    }

    if (action === 'reports' && method === 'GET') {
      const status = url.searchParams.get('status');
      const filter = status === 'open' || status === 'resolved' || status === 'dismissed' ? status : status === 'all' ? 'all' : 'open';
      const offset = Number(url.searchParams.get('offset') ?? 0) || 0;
      return json(await listReports(filter, offset, 50));
    }

    if (action === 'report' && method === 'PATCH') {
      const body = await readJson(request, 4_000);
      if (body instanceof Response) return body;
      const { id, ...changes } = (body ?? {}) as { id?: unknown; status?: unknown; adminNote?: unknown };
      const updated = typeof id === 'string' ? await updateReport(id, changes) : null;
      return updated ? json({ report: updated }) : json({ error: 'Report not found.' }, 404);
    }

    if (action === 'history' && method === 'GET') {
      return json({ history: await listHistory() });
    }

    if (action === 'photo' && method === 'POST') {
      return await handlePhotoUpload(request);
    }

    if (action === 'digest' && method === 'GET') {
      return json({ configured: digestConfigured(), to: digestConfigured() ? process.env.ADMIN_EMAIL : null });
    }

    if (action === 'digest-test' && method === 'POST') {
      await sendTestEmail(url.origin);
      return json({ ok: true });
    }

    if (action === 'stats' && method === 'GET') {
      const days = Number(url.searchParams.get('days'));
      return json(await readStats([7, 30, 90].includes(days) ? days : 30));
    }

    if (action === 'audio') {
      return await handleAdminAudio(request, url);
    }

    if (action === 'translate' && method === 'POST') {
      return await handleTranslate(request);
    }

    if (action === 'version' && method === 'GET') {
      const version = await readHistory(url.searchParams.get('pathname') ?? '');
      return version ? json({ content: version }) : json({ error: 'Version not found.' }, 404);
    }
  } catch (err) {
    console.error('Admin request failed:', err);
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500);
  }

  return json({ error: 'Unknown admin action.' }, 404);
}
