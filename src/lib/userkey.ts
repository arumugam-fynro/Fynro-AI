import 'server-only';
import { createClient } from './supabase/server';
import { decrypt, encrypt } from './crypto';

type Row = { ciphertext: string; hint: string; updated_at: string };
const MISSING = new Set(['PGRST205', '42P01', 'PGRST200']);

/** All reads/writes go through the user's own session, so Postgres RLS enforces "own row only". */
export async function getKeyMeta(userId: string): Promise<{ ready: boolean; hint: string | null; updatedAt: string | null }> {
  const sb = await createClient();
  const { data, error } = await sb.from('user_api_keys').select('hint, updated_at').eq('user_id', userId).maybeSingle();
  if (error) return { ready: !MISSING.has(error.code || ''), hint: null, updatedAt: null };
  return { ready: true, hint: data?.hint ?? null, updatedAt: data?.updated_at ?? null };
}

export async function loadKey(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.from('user_api_keys').select('ciphertext').eq('user_id', userId).maybeSingle<Pick<Row, 'ciphertext'>>();
  if (!data) return null;
  try { return decrypt(data.ciphertext, userId); } catch { return null; } // wrong secret / tampered row
}

export async function saveKey(userId: string, key: string): Promise<string | null> {
  const sb = await createClient();
  const hint = `sk-ant-…${key.slice(-4)}`;
  const { error } = await sb.from('user_api_keys').upsert({ user_id: userId, ciphertext: encrypt(key, userId), hint, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export async function removeKey(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { error } = await sb.from('user_api_keys').delete().eq('user_id', userId);
  return error ? error.message : null;
}
