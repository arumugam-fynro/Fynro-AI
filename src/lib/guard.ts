import 'server-only';
import type { NextRequest } from 'next/server';
import { getUser, type SessionUser } from './auth';
import { rateLimit } from './ratelimit';

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

/** Common gate for mutating API routes: same-origin, signed in, rate limited. */
export async function guard(req: NextRequest, bucket: string, limit: number, windowMs = 60_000): Promise<{ user: SessionUser } | { res: Response }> {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return { res: json(403, { error: 'Cross-origin requests are not allowed.' }) };
  const user = await getUser();
  if (!user) return { res: json(401, { error: 'Please sign in.' }) };
  const rl = rateLimit(`${bucket}:${user.id}`, limit, windowMs);
  if (!rl.ok) return { res: json(429, { error: 'Too many requests. Slow down a little.' }, { 'retry-after': String(rl.retryAfter) }) };
  return { user };
}
