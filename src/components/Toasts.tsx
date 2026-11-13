'use client';

import { useApp } from './AppProvider';
import { Icon, type IconName } from './Icon';

export const KIND_ICON: Record<string, IconName> = { alert: 'alert', success: 'check', reply: 'compose', info: 'info' };

export function Toasts() {
  const a = useApp();
  if (!a.toasts.length || a.notifOpen) return null;
  return (
    <div className="toasts" aria-live="polite">
      {a.toasts.map((t) => (
        <div key={t.id} className="toast pop" role="status">
          <button style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }} onClick={() => { if (t.chatId) a.openChat(t.chatId); a.markRead(t.id); a.dismissToast(t.id); }}>
            <span className={'nic ' + t.kind}><Icon n={KIND_ICON[t.kind] || 'info'} size="m" /></span>
            <span className="nbody"><b>{t.title}</b>{t.body && <span>{t.body}</span>}</span>
          </button>
          <button className="ib" style={{ width: 26, height: 26 }} aria-label="Dismiss" onClick={() => a.dismissToast(t.id)}><Icon n="x" size="s" /></button>
        </div>
      ))}
    </div>
  );
}
