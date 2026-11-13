'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { Sidebar, type MenuState } from './Sidebar';
import { Header } from './Header';
import { Thread } from './Thread';
import { Composer } from './Composer';
import { Icon } from './Icon';
import { Toasts } from './Toasts';
import { NotificationPanel } from './NotificationPanel';

// Heavy / rarely used surfaces are code-split and only fetched when opened.
const SettingsModal = dynamic(() => import('./SettingsModal').then((m) => m.SettingsModal));
const SearchModal = dynamic(() => import('./SearchModal').then((m) => m.SearchModal));

export function Shell() {
  const a = useApp();
  const [menu, setMenu] = useState<MenuState>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const chat = a.data.chats.find((c) => c.id === menu?.id);

  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);

  return (
    <div className="app" data-sbd={a.sbd ? 'open' : 'closed'} data-sbm={a.sbm ? 'open' : 'closed'}>
      <Sidebar menu={menu} setMenu={setMenu} renameId={renameId} setRenameId={setRenameId} />
      <main className="main">
        <div className="grain" />
        <Header menu={menu} setMenu={setMenu} />
        <Thread />
        <Composer />
        {!a.active?.messages.length && <div className="hero-end" />}
      </main>

      {menu && chat && (
        <>
          <div className="scrim" onClick={() => setMenu(null)} />
          <div className="menu pop" role="menu" style={{ top: menu.top, left: menu.left }}>
            <button className="mi" onClick={() => { a.updateChat(chat.id, (c) => ({ ...c, pinned: !c.pinned })); setMenu(null); }}>
              <Icon n="pin" size="m" />{chat.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="mi" onClick={() => { setRenameId(chat.id); setMenu(null); if (window.innerWidth < 768) a.toggleSidebar(); }}>
              <Icon n="pencil" size="m" />Rename
            </button>
            <div className="mdiv" />
            <button className="mi bad" onClick={() => {
              const id = chat.id;
              setMenu(null);
              a.askConfirm({ title: 'Delete chat?', body: `“${chat.title}” will be permanently removed.`, action: 'Delete', run: () => { a.deleteChat(id); a.flash('Chat deleted'); } });
            }}>
              <Icon n="trash" size="m" />Delete
            </button>
          </div>
        </>
      )}

      {a.searchOpen && <SearchModal />}
      {a.settings.open && <SettingsModal />}
      <NotificationPanel />
      <Toasts />

      {a.confirm && (
        <div className="ov mid" onClick={() => a.askConfirm(null)}>
          <div className="confirm pop" role="alertdialog" aria-modal="true" aria-label={a.confirm.title} onClick={(e) => e.stopPropagation()}>
            <h4>{a.confirm.title}</h4>
            <p>{a.confirm.body}</p>
            <div className="btns">
              <button className="btn ghost" onClick={() => a.askConfirm(null)}>Cancel</button>
              <button className="btn bad" autoFocus onClick={() => { const r = a.confirm!.run; a.askConfirm(null); r(); }}>{a.confirm.action}</button>
            </div>
          </div>
        </div>
      )}
      {a.snack && <div className="snack pop" role="status">{a.snack}</div>}
      {!a.online && <div className="offline pop" role="status">Offline — showing saved chats</div>}
    </div>
  );
}
