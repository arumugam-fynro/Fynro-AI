'use client';

import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './Icon';
import { KIND_ICON } from './Toasts';
import { ago } from '@/lib/util';

export function NotificationPanel() {
  const a = useApp();
  const [now, setNow] = useState(0);
  useEffect(() => { if (a.notifOpen) setNow(Date.now()); }, [a.notifOpen]);
  if (!a.notifOpen) return null;
  const list = a.data.notifs;
  return (
    <>
      <div className="scrim" style={{ zIndex: 54 }} onClick={() => a.setNotifOpen(false)} />
      <div className="np pop" role="dialog" aria-label="Notifications">
        <div className="np-h">
          <b>Notifications</b>
          <button className="act" disabled={!a.unread} style={{ opacity: a.unread ? 1 : .4 }} onClick={a.markAllRead}><Icon n="check" size="s" />Mark all read</button>
          <button className="ib" style={{ width: 28, height: 28 }} title="Notification settings" aria-label="Notification settings" onClick={() => a.openSettings('notifications')}><Icon n="gear" size="m" /></button>
        </div>
        <div className="np-list">
          {!list.length && <div className="np-empty">You are all caught up.</div>}
          {list.map((n) => (
            <button key={n.id} className={'nitem' + (n.read ? '' : ' unread')} onClick={() => { a.markRead(n.id); if (n.chatId && a.data.chats.some((c) => c.id === n.chatId)) { a.openChat(n.chatId); a.setNotifOpen(false); } }}>
              <span className={'nic ' + n.kind}><Icon n={KIND_ICON[n.kind] || 'info'} size="m" /></span>
              <span className="nbody"><b>{n.title}</b>{n.body && <span>{n.body}</span>}<em>{now ? ago(n.at, now) : ''}</em></span>
            </button>
          ))}
        </div>
        {!!list.length && (
          <div style={{ padding: '4px 16px 12px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <button className="act" style={{ marginLeft: -10 }} onClick={a.clearNotifs}><Icon n="trash" size="s" />Clear all</button>
          </div>
        )}
      </div>
    </>
  );
}
