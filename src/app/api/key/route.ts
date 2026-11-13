import type { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { guard, json } from '@/lib/guard';
import { KEY_RE, WS_RE, verifyKey } from '@/lib/anthropic';
import { getKeyMeta, loadKey, removeKey, saveKey } from '@/lib/userkey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Status only. The key itself is never returned to the browser, only a masked hint. */
export async function GET() {
  const user = await getUser();
  if (!user) return json(401, { error: 'Please sign in.' });
  const m = await getKeyMeta(user.id);
  return json(200, { saved: !!m.hint, hint: m.hint, updatedAt: m.updatedAt, ready: m.ready, serverKey: !!process.env.ANTHROPIC_API_KEY });
}

/** Save (and lock) a key: verified with Anthropic first, then stored encrypted. */
export async function PUT(req: NextRequest) {
  const g = await guard(req, 'key-write', 10);
  if ('res' in g) return g.res;
  let key = '', ws = '';
  try { const b = await req.json(); key = String(b?.key ?? '').trim(); ws = String(b?.workspaceId ?? '').trim(); } catch { return json(400, { error: 'Invalid request.' }); }
  if (!KEY_RE.test(key)) return json(400, { error: 'That does not look like an Anthropic key (it starts with sk-ant-).' });
  if (ws && !WS_RE.test(ws)) return json(400, { error: 'That does not look like a Workspace ID (letters, numbers, _ and -).' });

  const v = await verifyKey(key, ws || undefined, req.signal);
  if (!v.ok) return json(v.status === 401 || v.status === 403 ? 400 : 502, { error: v.message });

  const err = await saveKey(g.user.id, key, ws || undefined);
  if (err) {
    console.error('saveKey failed', err);
    return json(500, { error: 'Could not store the key. Has the database setup been applied?' });
  }
  return json(200, { saved: true });
}

/** Re-check the stored key against Anthropic without exposing it. */
export async function POST(req: NextRequest) {
  const g = await guard(req, 'key-test', 10);
  if ('res' in g) return g.res;
  const stored = await loadKey(g.user.id);
  if (!stored) return json(404, { error: 'No API key saved.' });
  const v = await verifyKey(stored.key, stored.workspaceId, req.signal);
  return v.ok ? json(200, { ok: true }) : json(400, { error: v.message });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, 'key-write', 10);
  if ('res' in g) return g.res;
  const err = await removeKey(g.user.id);
  return err ? json(500, { error: 'Could not remove the key.' }) : json(200, { saved: false });
}
