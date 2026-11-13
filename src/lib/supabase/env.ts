// Server-only: these are intentionally NOT NEXT_PUBLIC_*, so the browser never receives them.
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set');
  return { url, key };
}
