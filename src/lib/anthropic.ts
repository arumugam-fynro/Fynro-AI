import 'server-only';

import { DEFAULT_MODEL, MODELS } from './models';
export { DEFAULT_MODEL, MODELS };
export const isModel = (m: unknown): m is string => typeof m === 'string' && MODELS.some((x) => x.id === m);

export const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,400}$/;
const URL = 'https://api.anthropic.com/v1/messages';
export const WS_RE = /^[A-Za-z0-9_-]{5,100}$/;
// User-scoped keys (sk-ant-usr-…) must say which workspace to use; workspace keys must not need it.
const H = (key: string, workspaceId?: string) => ({
  'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
  ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
});

/** Cheap one-token request that proves a key is accepted. */
export async function verifyKey(key: string, workspaceId: string | undefined, signal?: AbortSignal): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(URL, { method: 'POST', signal, headers: H(key, workspaceId), body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) });
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, message: await friendly(res, workspaceId) };
  } catch {
    return { ok: false, status: 502, message: 'Could not reach Anthropic.' };
  }
}

export async function friendly(res: Response, workspaceId?: string) {
  if (res.status === 401 || res.status === 403) return 'Anthropic rejected this API key.';
  if (res.status === 429) return 'Anthropic rate limit reached. Try again shortly.';
  if (res.status === 529 || res.status >= 500) return 'Anthropic is busy right now. Try again.';
  try {
    const m: string = (await res.json())?.error?.message || `Anthropic returned ${res.status}.`;
    if (/workspace/i.test(m)) return workspaceId ? 'Anthropic did not accept that Workspace ID for this key. Check the ID in the Anthropic Console.' : 'This is a user-scoped key. Enter its Workspace ID below, or create a key inside a workspace.';
    return m;
  } catch { return `Anthropic returned ${res.status}.`; }
}

export type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } } | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };
export type AMsg = { role: 'user' | 'assistant'; content: string | Block[] };

export function streamMessages(key: string, workspaceId: string | undefined, body: { model: string; system: string; messages: AMsg[] }, signal: AbortSignal) {
  return fetch(URL, { method: 'POST', signal, headers: H(key, workspaceId), body: JSON.stringify({ ...body, max_tokens: 4096, stream: true }) });
}
