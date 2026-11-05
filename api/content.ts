import { getContent } from './_lib/content.js';
import { json } from './_lib/http.js';

// GET /api/content: the live routes and places. Briefly cached by the CDN, so
// admin edits show up within about a minute.
export default {
  async fetch() {
    return json(await getContent(), 200, { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' });
  },
};
