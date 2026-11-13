import type { NextRequest } from 'next/server';
import { guard, json } from '@/lib/guard';
import { DEFAULT_MODEL, friendly, isModel, streamMessages, type AMsg, type Block } from '@/lib/anthropic';
import { loadKey } from '@/lib/userkey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type In = {
  model?: string;
  system?: string;
  messages?: { role: 'user' | 'assistant'; content: string }[];
  files?: { name: string; mime: string; data: string }[]; // attached to the last user message
};

const MAX_BODY = 8 * 1024 * 1024;
const IMG = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const enc = new TextEncoder();

/** Anthropic SSE → plain text deltas. */
function toText(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  let buf = '';
  return new ReadableStream({
    async start(ctl) {
      const r = upstream.getReader();
      try {
        for (;;) {
          const { value, done } = await r.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const d = JSON.parse(line.slice(5));
              if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') ctl.enqueue(enc.encode(d.delta.text));
            } catch {}
          }
        }
        ctl.close();
      } catch (e) { ctl.error(e); }
    },
    cancel: () => upstream.cancel(),
  });
}

export async function POST(req: NextRequest) {
  const g = await guard(req, 'chat', 40);
  if ('res' in g) return g.res;
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return json(413, { error: 'Attachments are too large.' });

  let body: In;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { error: 'Attachments are too large.' });
    body = JSON.parse(raw);
  } catch { return json(400, { error: 'Invalid request body.' }); }

  // The user's locked key (decrypted server-side only), else an optional shared server key.
  const key = (await loadKey(g.user.id)) || process.env.ANTHROPIC_API_KEY || '';
  if (!key) return json(401, { error: 'Add your Anthropic API key in Settings to start chatting.', code: 'no_key' });

  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-40)
    .map<AMsg>((m) => ({ role: m.role, content: m.content.slice(0, 60000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json(400, { error: 'Nothing to send.' });

  // Attach images / PDFs to the final user message.
  const files = Array.isArray(body.files) ? body.files.slice(0, 5) : [];
  if (files.length) {
    const blocks: Block[] = [];
    for (const f of files) {
      if (typeof f?.data !== 'string' || !B64.test(f.data)) return json(400, { error: 'Invalid attachment.' });
      if (IMG.has(f.mime)) blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mime, data: f.data } });
      else if (f.mime === 'application/pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
      else return json(400, { error: `Unsupported attachment type: ${String(f.mime).slice(0, 40)}` });
    }
    const last = msgs[msgs.length - 1];
    msgs[msgs.length - 1] = { role: 'user', content: [...blocks, { type: 'text', text: String(last.content) }] };
  }

  try {
    const res = await streamMessages(key, {
      model: isModel(body.model) ? body.model : DEFAULT_MODEL,
      system: typeof body.system === 'string' ? body.system.slice(0, 4000) : '',
      messages: msgs,
    }, req.signal);
    if (!res.ok || !res.body) {
      const bad = res.status === 401 || res.status === 403;
      return json(bad ? 424 : 502, { error: bad ? 'Your saved Anthropic key was rejected. Replace it in Settings › API key.' : await friendly(res), code: bad ? 'bad_key' : undefined });
    }
    return new Response(toText(res.body), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'AbortError') return new Response(null, { status: 499 });
    return json(502, { error: 'Could not reach Anthropic.' });
  }
}
