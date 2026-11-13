import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };
type Body = {
  action?: 'chat' | 'test';
  provider?: 'anthropic' | 'openai';
  model?: string;
  system?: string;
  messages?: Msg[];
};

const MODEL_RE = /^[\w.\-:]{1,64}$/;
const enc = new TextEncoder();

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Pull the human-readable message out of a provider error payload without echoing the request. */
async function providerError(res: Response) {
  let msg = `Provider returned ${res.status}`;
  try {
    const j = await res.json();
    msg = j?.error?.message || j?.message || msg;
  } catch {}
  if (res.status === 401 || res.status === 403) msg = 'The API key was rejected. Check it in Settings › API key.';
  return json(res.status === 401 || res.status === 403 ? 401 : 502, msg);
}

/** Turn a provider SSE stream into a plain text stream of deltas. */
function sseToText(upstream: ReadableStream<Uint8Array>, pick: (data: any) => string): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  let buf = '';
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const t = pick(JSON.parse(data));
              if (t) controller.enqueue(enc.encode(t));
            } catch {}
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      return upstream.cancel();
    },
  });
}

/** Tells the client whether the server has its own fallback keys (never reveals them). */
export async function GET() {
  return new Response(JSON.stringify({ anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, 'Invalid request body.');
  }

  const provider = body.provider === 'openai' ? 'openai' : 'anthropic';
  const model = body.model && MODEL_RE.test(body.model) ? body.model : provider === 'openai' ? 'gpt-4.1' : 'claude-sonnet-5-5';
  // The user's own key (sent per request, never stored or logged here) wins over the server key.
  const userKey = (req.headers.get('x-user-api-key') || '').trim();
  const apiKey = userKey || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || '';
  if (!apiKey) return json(401, 'No API key configured. Add one in Settings › API key.');

  const isTest = body.action === 'test';
  const messages: Msg[] = isTest
    ? [{ role: 'user', content: 'Reply with the single word: ok' }]
    : (Array.isArray(body.messages) ? body.messages : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-30)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json(400, 'Nothing to send.');

  const system = typeof body.system === 'string' ? body.system.slice(0, 4000) : '';
  const maxTokens = isTest ? 8 : 2048;
  const signal = req.signal;
  const headers = { 'content-type': 'application/json' };
  const out = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' };

  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: { ...headers, 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: system || undefined, messages, stream: !isTest }),
      });
      if (!res.ok || !res.body) return providerError(res);
      if (isTest) return new Response('ok', { headers: out });
      return new Response(sseToText(res.body, (d) => (d.type === 'content_block_delta' && d.delta?.type === 'text_delta' ? d.delta.text : '')), { headers: out });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { ...headers, authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: !isTest, messages: system ? [{ role: 'system', content: system }, ...messages] : messages }),
    });
    if (!res.ok || !res.body) return providerError(res);
    if (isTest) return new Response('ok', { headers: out });
    return new Response(sseToText(res.body, (d) => d.choices?.[0]?.delta?.content || ''), { headers: out });
  } catch (e: any) {
    if (e?.name === 'AbortError') return new Response(null, { status: 499 });
    return json(502, 'Could not reach the model provider.');
  }
}
