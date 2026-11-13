'use client';

import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { openMenuAt, type MenuState } from './Sidebar';

export function Header({ menu, setMenu }: { menu: MenuState; setMenu: (m: MenuState) => void }) {
  const a = useApp();
  return (
    <header className="hdr">
      <button className="ib t only-m" title="Menu" aria-label="Open menu" onClick={a.toggleSidebar}><Icon n="menu" size="l" /></button>
      <span className="only-d" style={{ color: 'var(--text)', display: 'inline-flex' }}><Icon n="compose" /></span>
      {a.active ? (
        <button className="ttl" onClick={(e) => openMenuAt(e, a.active!.id, menu, setMenu)} aria-haspopup="menu">
          <span>{a.active.title}</span>
          <span style={{ color: 'var(--muted)', display: 'inline-flex' }}><Icon n="chev" size="m" /></span>
        </button>
      ) : (
        <span className="ttl"><span>Assistant</span></span>
      )}
      <div style={{ flex: 1 }} />
      <button className="ib t only-m" title="New chat" aria-label="New chat" onClick={a.newChat}><Icon n="compose" size="l" /></button>
      <button className="ib round" title="Notifications" aria-label={`Notifications${a.unread ? `, ${a.unread} unread` : ''}`} aria-expanded={a.notifOpen} onClick={() => a.setNotifOpen(!a.notifOpen)}>
        <Icon n="bell" size="m" />
        {a.unread > 0 && <span className="dot">{a.unread > 9 ? '9+' : a.unread}</span>}
      </button>
      <button className="ib round" title={a.dark ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme" onClick={a.toggleTheme}>
        <Icon n={a.dark ? 'sun' : 'moon'} size="m" />
      </button>
    </header>
  );
}
