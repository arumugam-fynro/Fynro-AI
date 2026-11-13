'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { Logo } from './Logo';
import type { Chat } from '@/lib/types';

export type MenuState = { id: string; top: number; left: number } | null;

export function openMenuAt(e: React.MouseEvent<HTMLElement>, id: string, cur: MenuState, set: (m: MenuState) => void, w = 184) {
  e.stopPropagation();
  if (cur?.id === id) return set(null);
  const r = e.currentTarget.getBoundingClientRect();
  let top = r.bottom + 4;
  const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  if (top + 150 > window.innerHeight) top = r.top - 150;
  set({ id, top, left });
}

const Row = memo(function Row({ chat, on, onOpen, onMenu }: { chat: Chat; on: boolean; onOpen: (id: string) => void; onMenu: (e: React.MouseEvent<HTMLElement>, id: string) => void }) {
  return (
    <div className={'row' + (on ? ' on' : '')}>
      <button className="go" onClick={() => onOpen(chat.id)}>
        {chat.pinned && <Icon n="pin" size="s" />}
        <span>{chat.title}</span>
      </button>
      <button className="more" title="More" aria-label="Chat options" onClick={(e) => onMenu(e, chat.id)}><Icon n="dots" /></button>
    </div>
  );
});

function RenameInput({ chat, done }: { chat: Chat; done: (v: string | null) => void }) {
  const [v, setV] = useState(chat.title);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <input
      ref={ref} className="inp sm" value={v} autoFocus aria-label="Rename chat"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => done(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(v);
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
      }}
    />
  );
}

export function Sidebar({ menu, setMenu, renameId, setRenameId }: { menu: MenuState; setMenu: (m: MenuState) => void; renameId: string | null; setRenameId: (id: string | null) => void }) {
  const a = useApp();
  const [acct, setAcct] = useState(false);
  const { chats, activeId, connectors, name } = a.data;

  const sections = useMemo(() => {
    const sorted = [...chats].sort((x, y) => y.updated - x.updated);
    const s: { label: string; items: Chat[] }[] = [];
    const pinned = sorted.filter((c) => c.pinned), rec = sorted.filter((c) => !c.pinned);
    if (pinned.length) s.push({ label: 'Pinned', items: pinned });
    if (rec.length) s.push({ label: 'Recents', items: rec });
    return s;
  }, [chats]);

  const connected = connectors.filter((c) => c.connected).length;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const onMenu = (e: React.MouseEvent<HTMLElement>, id: string) => { setAcct(false); openMenuAt(e, id, menu, setMenu); };

  return (
    <>
      <div className="backdrop" onClick={a.toggleSidebar} />
      <aside className="sb" aria-label="Sidebar">
        <div className="sb-top">
          <Logo />
          <div className="name">Fynro</div>
          <button className="ib" title="Close sidebar" aria-label="Close sidebar" onClick={a.toggleSidebar}><Icon n="panel" /></button>
        </div>
        <div style={{ padding: '0 14px 14px' }}>
          <button className="search" onClick={() => a.setSearchOpen(true)}>
            <Icon n="search" /><span style={{ flex: 1 }}>Search</span><span className="k">⌘ K</span>
          </button>
        </div>
        <div className="hr" />
        <div className="nav">
          <button className="navb pri" onClick={a.newChat}><Icon n="plus" /><span style={{ flex: 1 }}>New chat</span></button>
          <button className="navb" onClick={() => a.openSettings('connectors')}><Icon n="plug" /><span style={{ flex: 1 }}>Connectors</span><span className="badge">{connected}</span></button>
        </div>
        <div className="list">
          {sections.map((s) => (
            <div key={s.label}>
              <div className="sec">{s.label}</div>
              {s.items.map((c) =>
                renameId === c.id ? (
                  <RenameInput key={c.id} chat={c} done={(v) => {
                    if (v && v.trim()) a.updateChat(c.id, (x) => ({ ...x, title: v.trim() }));
                    setRenameId(null);
                  }} />
                ) : (
                  <Row key={c.id} chat={c} on={c.id === activeId} onOpen={a.openChat} onMenu={onMenu} />
                )
              )}
            </div>
          ))}
          {!chats.length && <div className="empty">No chats yet.</div>}
        </div>
        <div className="acct">
          <button onClick={() => { setAcct(!acct); setMenu(null); }}>
            <span className="av">{initial}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Pro plan</span>
            </span>
            <span style={{ color: 'var(--muted)' }}><Icon n="updown" size="m" /></span>
          </button>
          {acct && (
            <>
              <div className="scrim" onClick={() => setAcct(false)} />
              <div className="menu abs pop" role="menu">
                <button className="mi" onClick={() => { setAcct(false); a.openSettings('general'); }}><Icon n="gear" size="m" />Settings</button>
                <button className="mi" onClick={() => { setAcct(false); a.toggleTheme(); }}><Icon n={a.dark ? 'sun' : 'moon'} size="m" />{a.dark ? 'Light theme' : 'Dark theme'}</button>
                <div className="mdiv" />
                <button className="mi" onClick={() => setAcct(false)}><Icon n="logout" size="m" />Log out</button>
              </div>
            </>
          )}
        </div>
      </aside>
      <aside className="rail" aria-label="Sidebar rail">
        <div style={{ marginBottom: 8 }}><Logo /></div>
        <button className="ib" title="Open sidebar" aria-label="Open sidebar" onClick={a.toggleSidebar}><Icon n="panel" /></button>
        <button className="ib" title="New chat" aria-label="New chat" onClick={a.newChat}><Icon n="plus" /></button>
        <button className="ib" title="Search" aria-label="Search" onClick={() => a.setSearchOpen(true)}><Icon n="search" /></button>
        <button className="ib" title="Connectors" aria-label="Connectors" onClick={() => a.openSettings('connectors')}><Icon n="plug" /></button>
        <div style={{ flex: 1 }} />
        <button className="av" title="Settings" aria-label="Settings" style={{ cursor: 'pointer' }} onClick={() => a.openSettings('general')}>{initial}</button>
      </aside>
    </>
  );
}
