/**
 * A small in-memory rate limiter for API routes: at most `max` requests per `windowMs` for each caller.
 *
 * Honest limits: serverless hosts run several copies of the app, and each copy counts on its own, so this
 * is a cheap first brake against a runaway script, not a hard guarantee. For a hard limit, also turn on
 * Vercel Firewall rate limiting (see README, "Limits and abuse protection").
 */

const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep memory bounded: when the table is full, drop the oldest callers first.
  if (hits.size > MAX_KEYS) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= MAX_KEYS * 0.8) break;
    }
  }
  return { ok: true, retryAfter: 0 };
}

/** The caller's address as the host reports it (Vercel sets x-forwarded-for itself), or "unknown". */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Reads a request body as JSON but refuses to buffer more than `maxBytes` (a header can lie, so the stream is counted). */
export async function readJsonLimited(req: Request, maxBytes: number): Promise<unknown | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes || !req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  try {
    const all = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      all.set(c, o);
      o += c.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    return null;
  }
}
