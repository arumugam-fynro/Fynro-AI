'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { Chip } from './Chip';
import type { Message } from '@/lib/types';

const Bubble = memo(function Bubble({ m, last, onRetry }: { m: Message; last: boolean; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === 'user') {
    return (
      <div className="ubox">
        {!!m.attachments?.length && <div className="chips" style={{ justifyContent: 'flex-end' }}>{m.attachments.map((a) => <Chip key={a.id} a={a} />)}</div>}
        {m.text && <div className="ubub">{m.text}</div>}
      </div>
    );
  }
  return (
    <div className="abox">
      {!!m.sources?.length && <div className="pill"><Icon n="plug" size="s" />Checked {m.sources.join(' · ')}</div>}
      <div className={'atext' + (m.error ? ' err' : '') + (m.streaming ? ' caret' : '')}>{m.text}</div>
      {m.table && (
        <div className="tbl glass">
          <table>
            <thead><tr>{m.table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>{m.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {m.note && <div className="atext">{m.note}</div>}
      {!m.streaming && (
        <div className="acts">
          <button className="act" onClick={() => {
            try { navigator.clipboard.writeText([m.text, m.note].filter(Boolean).join('\n\n')); } catch {}
            setCopied(true); setTimeout(() => setCopied(false), 1500);
          }}><Icon n="copy" size="s" />{copied ? 'Copied' : 'Copy'}</button>
          {last && <button className="act" onClick={onRetry}><Icon n="retry" size="s" />Retry</button>}
        </div>
      )}
    </div>
  );
});

export function Thread() {
  const a = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [greet, setGreet] = useState('');
  const msgs = a.active?.messages ?? [];
  const lastMsg = msgs[msgs.length - 1];

  useEffect(() => {
    const h = new Date().getHours();
    setGreet(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Keep pinned to the bottom while messages stream in.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [a.active?.id, msgs.length, lastMsg?.text, a.pending]);

  if (!msgs.length) {
    return (
      <div className="hero">
        <div className="hi">{greet && `${greet}, ${a.data.name}`}</div>
        <h1>What should we look at today?</h1>
      </div>
    );
  }
  return (
    <div className="scroll" ref={ref}>
      <div className="col" role="log" aria-live="polite">
        {msgs.map((m, i) => <Bubble key={i} m={m} last={i === msgs.length - 1 && !a.pending} onRetry={a.retry} />)}
        {a.pending && lastMsg?.role === 'user' && (
          <div className="think">{a.activeSources(false).length ? `Reading ${a.activeSources(false).join(' · ')}…` : 'Thinking…'}</div>
        )}
      </div>
    </div>
  );
}
