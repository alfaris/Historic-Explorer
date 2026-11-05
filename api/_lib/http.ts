// Small response helpers shared by the API functions.

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

/** Reads a JSON body, refusing anything larger than `maxBytes`. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown | Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return json({ error: 'Request is too large.' }, 413);
  const text = await request.text();
  if (text.length > maxBytes) return json({ error: 'Request is too large.' }, 413);
  try {
    return JSON.parse(text);
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }
}

export const hasBlobStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
