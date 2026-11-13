'use client';

import { useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';

export function SearchModal() {
  const a = useApp();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...a.data.chats].sort((x, y) => y.updated - x.updated)
      .filter((c) => !s || c.title.toLowerCase().includes(s) || c.messages.some((m) => m.text.toLowerCase().includes(s)))
      .map((c) => {
        const hit = s ? c.messages.find((m) => m.text.toLowerCase().includes(s)) : undefined;
        const m = hit || c.messages[c.messages.length - 1];
        return { id: c.id, title: c.title, snippet: (m?.text || '').replace(/\n+/g, ' ') };
      });
  }, [a.data.chats, q]);

  return (
    <div className="ov" onClick={() => a.setSearchOpen(false)}>
      <div className="modal pop" role="dialog" aria-modal="true" aria-label="Search chats" onClick={(e) => e.stopPropagation()}>
        <div className="srow">
          <Icon n="search" />
          <input autoFocus placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ib" aria-label="Close search" onClick={() => a.setSearchOpen(false)}><Icon n="x" /></button>
        </div>
        <div className="sres">
          {results.map((r) => (
            <button key={r.id} className="sitem" onClick={() => { a.openChat(r.id); a.setSearchOpen(false); }}>
              <b>{r.title}</b><span>{r.snippet}</span>
            </button>
          ))}
          {!results.length && <div className="empty">No chats match “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
