import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hardenCookie } from '@/lib/supabase/cookies';

// Public: the login page, PWA plumbing that must load before sign-in, and static assets.
const PUBLIC = [/^\/login$/, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/favicon\.ico$/, /^\/icons\//, /^\/_next\//];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new NextResponse('Server is not configured', { status: 500 });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, hardenCookie(options)));
      },
    },
  });

  // Verifies the JWT signature via JWKS and refreshes the session cookie when it is about to expire.
  const { data } = await supabase.auth.getClaims();
  const authed = !!data?.claims?.sub;

  if (PUBLIC.some((r) => r.test(pathname))) {
    if (authed && pathname === '/login') return NextResponse.redirect(new URL('/', request.url));
    return response;
  }
  if (authed) return response;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
