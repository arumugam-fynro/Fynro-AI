import 'server-only';

/**
 * Fixed-window limiter held in memory. Good for a single Node instance; on serverless/multi-instance
 * deployments swap the Map for a shared store (Upstash/Redis) behind the same function.
 */
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  h.n++;
  return h.n > limit ? { ok: false, retryAfter: Math.ceil((h.reset - now) / 1000) } : { ok: true, retryAfter: 0 };
}

export function clearLimit(key: string) {
  hits.delete(key);
}

export function clientIp(h: Headers) {
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}
