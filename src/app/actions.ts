'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { clearLimit, clientIp, rateLimit } from '@/lib/ratelimit';

export type LoginState = { error?: string };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  if (!EMAIL.test(email) || !password || password.length > 256) return { error: 'Enter a valid email and password.' };

  // Throttle guessing: per IP+email (5 / 15 min) and per IP overall (20 / 15 min).
  const ip = clientIp(await headers());
  const k1 = `login:${ip}:${email}`;
  const a = rateLimit(k1, 5, 15 * 60_000);
  const b = rateLimit(`login-ip:${ip}`, 20, 15 * 60_000);
  if (!a.ok || !b.ok) {
    const m = Math.ceil(Math.max(a.retryAfter, b.retryAfter) / 60);
    return { error: `Too many attempts. Try again in ${m} minute${m === 1 ? '' : 's'}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // One generic message for every failure so the form cannot be used to discover which emails exist.
  if (error) return { error: 'Invalid email or password.' };

  clearLimit(k1);
  redirect('/');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut(); // revokes the refresh token server-side and clears the cookies
}
