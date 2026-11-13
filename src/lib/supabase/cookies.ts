import type { CookieOptions } from '@supabase/ssr';

/**
 * The browser never reads the Supabase session (all auth happens server-side), so lock the cookie
 * down: invisible to JavaScript (XSS cannot steal it), HTTPS-only in production, not sent cross-site.
 */
export const hardenCookie = (options: CookieOptions = {}): CookieOptions => ({
  ...options,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});
