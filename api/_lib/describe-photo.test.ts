import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stand-ins for Blob (an uploaded photo), the site's built-in photos and Gemini.
const WEBP = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 '), 1, 2, 3]);
const UPLOAD_ID = 'a'.repeat(64);
let reply = '';
const calls: { model: string; mimeType: string; prompt: string }[] = [];
const fetched: string[] = [];

vi.mock('@vercel/blob', () => ({
  get: async (path: string) => (path === `photos/${UPLOAD_ID}` ? { stream: new Response(WEBP).body, blob: { contentType: 'image/webp' } } : null),
  head: async () => ({}),
  put: async () => ({}),
  BlobNotFoundError: class extends Error {},
}));
vi.mock('./gemini.js', () => ({
  getClient: () => ({
    models: {
      generateContent: async (req: { model: string; contents: { parts: ({ inlineData: { mimeType: string } } | { text: string })[] }[] }) => {
        const parts = req.contents[0].parts;
        calls.push({ model: req.model, mimeType: (parts[0] as { inlineData: { mimeType: string } }).inlineData.mimeType, prompt: (parts[1] as { text: string }).text });
        return { text: reply };
      },
    },
  }),
}));

const { handleDescribePhoto, parseDescribeRequest, pickDescriptions } = await import('./describe-photo');

const post = (body: unknown, ip = '1.1.1.1') =>
  handleDescribePhoto(new Request('https://cairo.example/api/admin?action=describe-photo', { method: 'POST', body: JSON.stringify(body), headers: { 'x-real-ip': ip } }));

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test';
  calls.length = 0;
  fetched.length = 0;
  reply = JSON.stringify({ en: ' The carved stone façade. ', ar: 'الواجهة الحجرية المنحوتة.', fr: 'La façade de pierre sculptée.', es: 'La fachada de piedra tallada.' });
  vi.stubGlobal('fetch', async (url: URL) => {
    fetched.push(String(url));
    return String(url).endsWith('-480.webp') ? new Response(WEBP) : new Response('no', { status: 404 });
  });
});

describe('parseDescribeRequest', () => {
  it("accepts only the app's photo addresses", () => {
    expect(parseDescribeRequest({ src: '/images/photos/place-1.webp', name: 'Al-Aqmar' })).toEqual({ src: '/images/photos/place-1.webp', name: 'Al-Aqmar' });
    expect(parseDescribeRequest({ src: `/api/photo?id=${UPLOAD_ID}` })).toMatchObject({ name: '' });
    for (const src of ['https://evil.example/x.webp', '/images/photos/../secret.webp', '//evil.example/a.webp', 42]) {
      expect(parseDescribeRequest({ src })).toHaveProperty('error');
    }
  });
});

describe('pickDescriptions', () => {
  it('keeps a trimmed, length-limited string per language', () => {
    expect(pickDescriptions({ en: '  Two  domes. ', ar: '', fr: 7, es: 'x'.repeat(400) })).toEqual({ photoAltEn: 'Two domes.', photoAltEs: 'x'.repeat(250) });
    expect(pickDescriptions(null)).toEqual({});
  });
});

describe('handleDescribePhoto', () => {
  it('sends the 480px copy of a built-in photo and returns a draft in each language', async () => {
    const res = await post({ src: '/images/photos/place-1.webp', name: 'Ibn Tulun' }, '2.0.0.1');
    expect(res.status).toBe(200);
    expect((await res.json()).texts).toEqual({
      photoAltEn: 'The carved stone façade.',
      photoAltAr: 'الواجهة الحجرية المنحوتة.',
      photoAltFr: 'La façade de pierre sculptée.',
      photoAltEs: 'La fachada de piedra tallada.',
    });
    expect(fetched).toEqual(['https://cairo.example/images/photos/place-1-480.webp']);
    expect(calls[0]).toMatchObject({ mimeType: 'image/webp' });
    expect(calls[0].prompt).toContain('"Ibn Tulun"');
  });

  it('reads an uploaded photo from Blob', async () => {
    const res = await post({ src: `/api/photo?id=${UPLOAD_ID}` }, '2.0.0.2');
    expect(res.status).toBe(200);
    expect(fetched).toEqual([]);
  });

  it('says so when the photo or the reply is unusable', async () => {
    expect((await post({ src: `/api/photo?id=${'b'.repeat(64)}` }, '2.0.0.3')).status).toBe(404);
    reply = 'not json';
    expect((await post({ src: '/images/photos/place-1.webp' }, '2.0.0.4')).status).toBe(502);
    reply = '{}';
    expect((await post({ src: '/images/photos/place-1.webp' }, '2.0.0.5')).status).toBe(502);
    expect((await post({ src: 'https://evil.example/a.webp' }, '2.0.0.6')).status).toBe(400);
  });

  it('is rate limited', async () => {
    let last = 0;
    for (let i = 0; i < 41; i++) last = (await post({ src: '/images/photos/place-1.webp' }, '9.9.9.9')).status;
    expect(last).toBe(429);
  });
});
