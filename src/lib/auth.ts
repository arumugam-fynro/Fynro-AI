import 'server-only';
import { createClient } from './supabase/server';

export type SessionUser = { id: string; email: string };

/**
 * Returns the signed-in user, or null. getClaims() verifies the access-token signature against the
 * project's JWKS (ES256) instead of trusting the cookie, so a forged cookie cannot pass.
 */
export async function getUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const c = data?.claims;
    if (error || !c?.sub) return null;
    return { id: c.sub, email: (c as { email?: string }).email || '' };
  } catch {
    return null;
  }
}
