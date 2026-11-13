import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';
import { hardenCookie } from './cookies';

/** Supabase client bound to the request's cookies (httpOnly session). Uses the publishable key only. */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, hardenCookie(options))); } catch { /* called from a Server Component: the proxy refreshes cookies */ }
      },
    },
  });
}
