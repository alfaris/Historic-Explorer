import { getContent } from '../_lib/content.js';
import { etagMatches, serializeV1 } from '../_lib/content-v1.js';

// GET /api/v1/content: the content for the native apps, with schema and app
// versions and audio URLs (see _lib/content-v1). Cached by the CDN like
// /api/content; an app sends If-None-Match and gets 304 when nothing changed.
const CACHE = 'public, max-age=0, s-maxage=30, stale-while-revalidate=300';

export default {
  async fetch(request: Request) {
    const { body, etag } = serializeV1(await getContent());
    if (etagMatches(request.headers.get('if-none-match'), etag)) {
      // Never cacheable, so no cache in between can answer a plain request with an empty 304.
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } });
    }
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': CACHE, ETag: etag } });
  },
};
