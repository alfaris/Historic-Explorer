// A daily email to the admin listing the visitor reports that arrived since
// the last one. Sent by a Vercel Cron job (vercel.json) through Resend.
//
//   GET /api/digest  (Authorization: Bearer $CRON_SECRET, sent by Vercel Cron)
//
// Off unless RESEND_API_KEY and ADMIN_EMAIL are set. Nothing is sent on days
// with no new reports. The time of the last email is kept in Blob, so a report
// is never emailed twice, and one that arrives during a failed send is
// included next time.

import { BlobNotFoundError, get, put } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';
import type { Report } from './reports.js';
import { openReportsSince } from './reports.js';
import { hasBlobStore, json } from './http.js';

const STATE = 'digest/state.json';
const DEFAULT_FROM = 'Cairo Walks <onboarding@resend.dev>';
const TYPE_LABEL: Record<Report['type'], string> = {
  location: 'Wrong location',
  text: 'Wrong name or description',
  closed: 'Closed / gone',
  photo: 'Photo problem',
};

export const digestConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Sends one email through Resend. Throws with Resend's message if it fails. */
export async function sendEmail({ subject, text, html }: { subject: string; text: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM || DEFAULT_FROM,
      to: process.env.ADMIN_EMAIL!.split(',').map(s => s.trim()).filter(Boolean),
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Sending the email failed (${res.status}): ${(detail as { message?: string }).message ?? 'unknown error'}`);
  }
}

/** The email for a batch of reports. Visitor text is escaped in the HTML. */
export function buildDigest(reports: Report[], total: number, adminUrl: string) {
  const subject = `Cairo Walks: ${total} new visitor report${total === 1 ? '' : 's'}`;
  const more = total > reports.length ? `\n…and ${total - reports.length} more.` : '';
  const text = [
    `${total} new report${total === 1 ? '' : 's'} since the last email:`,
    '',
    ...reports.map(r => `• ${TYPE_LABEL[r.type]}: ${r.placeName}${r.message ? `\n  "${r.message}"` : ''}${r.suggested ? `\n  Suggested position: ${r.suggested.lat}, ${r.suggested.lng}` : ''}`),
    more,
    '',
    `Review them: ${adminUrl}`,
  ].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<p>${total} new report${total === 1 ? '' : 's'} since the last email:</p>
<ul style="padding-left:18px">${reports
    .map(
      r => `<li style="margin-bottom:10px"><strong>${escapeHtml(TYPE_LABEL[r.type])}</strong>: ${escapeHtml(r.placeName)}${
        r.message ? `<br><span style="color:#555">“${escapeHtml(r.message)}”</span>` : ''
      }${r.suggested ? `<br><span style="color:#888">Suggested position: ${r.suggested.lat}, ${r.suggested.lng}</span>` : ''}</li>`,
    )
    .join('')}</ul>${more ? `<p>…and ${total - reports.length} more.</p>` : ''}
<p><a href="${escapeHtml(adminUrl)}">Review them in the admin</a></p></div>`;
  return { subject, text, html };
}

async function readLastSent(): Promise<string | null> {
  try {
    const result = await get(STATE, { access: 'private', useCache: false });
    if (!result?.stream) return null;
    const { lastSentAt } = JSON.parse(await new Response(result.stream).text());
    return typeof lastSentAt === 'string' ? lastSentAt : null;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

const authorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

/** Sends the digest if there's anything new. Returns what happened. */
export async function runDigest(siteUrl: string, now = new Date()): Promise<{ sent: number } | { skipped: string }> {
  if (!digestConfigured()) return { skipped: 'RESEND_API_KEY and ADMIN_EMAIL are not set' };
  if (!hasBlobStore()) return { skipped: 'No Blob store is connected' };
  // The first time, look back one day rather than emailing every old report.
  const since = (await readLastSent()) ?? new Date(now.getTime() - 86_400_000).toISOString();
  const { reports, total } = await openReportsSince(since);
  if (total === 0) return { skipped: 'No new reports' };
  await sendEmail(buildDigest(reports, total, `${siteUrl}/admin`));
  // Remember the newest report emailed, not the current time: a report that
  // arrives while this runs is then picked up next time, not skipped.
  const newest = reports[0]?.createdAt ?? now.toISOString();
  await put(STATE, JSON.stringify({ lastSentAt: newest }), { access: 'private', contentType: 'application/json', allowOverwrite: true });
  return { sent: total };
}

export async function handleDigest(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401);
  try {
    return json(await runDigest(new URL(request.url).origin));
  } catch (err) {
    console.error('Report digest failed:', err);
    return json({ error: (err as Error).message }, 500);
  }
}

/** Admin "Send test email": checks the settings work. */
export async function sendTestEmail(siteUrl: string) {
  if (!digestConfigured()) throw new Error('Set RESEND_API_KEY and ADMIN_EMAIL in Vercel first.');
  await sendEmail({
    subject: 'Cairo Walks: test email',
    text: `This is a test. Daily report emails are set up and will go to ${process.env.ADMIN_EMAIL}.\n\n${siteUrl}/admin`,
    html: `<p>This is a test. Daily report emails are set up and will go to ${escapeHtml(process.env.ADMIN_EMAIL!)}.</p><p><a href="${escapeHtml(siteUrl)}/admin">Open the admin</a></p>`,
  });
}
