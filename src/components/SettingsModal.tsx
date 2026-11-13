'use client';

import { useState } from 'react';
import { useApp, type Tab } from './AppProvider';
import { Icon, type IconName } from './Icon';
import { MODELS } from '@/lib/models';
import type { Persisted } from '@/lib/types';

const TABS: [Tab, string, IconName][] = [
  ['general', 'General', 'user'], ['appearance', 'Appearance', 'palette'], ['notifications', 'Notifications', 'bell'],
  ['api', 'API key', 'key'], ['data', 'Data & privacy', 'shield'],
];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return <div className="seg" role="radiogroup">{options.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>;
}
const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button className={'tog' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><i /></button>
);

function ApiKeyPanel() {
  const a = useApp();
  const { keyInfo: k } = a;
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const save = async () => {
    setErr(''); setOk('');
    const e = await a.saveApiKey(val.trim());
    if (e) return setErr(e);
    setVal(''); setShow(false); setOk('Key verified and locked.');
  };
  const test = async () => { setErr(''); setOk(''); const e = await a.testApiKey(); e ? setErr(e) : setOk('Key is working.'); };
  const remove = () => a.askConfirm({
    title: 'Remove API key?', body: 'Chat stops working until you add a key again.', action: 'Remove',
    run: async () => { const e = await a.removeApiKey(); e ? setErr(e) : a.flash('API key removed'); },
  });

  return (
    <>
      <h3>API key</h3>
      <p className="hint" style={{ margin: '-10px 0 0' }}>Fynro answers with Claude from Anthropic using your own API key. Get one at console.anthropic.com.</p>

      {!k.ready && (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <span className="nic alert"><Icon n="alert" size="m" /></span>
          <span className="grow"><b>Database setup pending</b><span>Keys can&apos;t be stored yet. Apply <code>supabase/migrations/20261113_security_and_api_keys.sql</code> to your Supabase project, then reload.</span></span>
        </div>
      )}

      {k.saved ? (
        <div className="card">
          <span className="nic" style={{ color: 'var(--ok)' }}><Icon n="check" size="m" /></span>
          <span className="grow">
            <b className="keyhint">{k.hint}</b>
            <span>Locked. Stored encrypted on the server and never shown again.</span>
          </span>
          <button className="btn ghost" onClick={() => void test()} disabled={a.keyBusy}>{a.keyBusy ? 'Checking…' : 'Test'}</button>
          <button className="btn bad" onClick={remove} disabled={a.keyBusy}>Remove</button>
        </div>
      ) : (
        k.serverKey && <div className="status ok"><Icon n="check" size="s" />This workspace provides a shared key, so chat already works. You can add your own below.</div>
      )}

      <div className="field">
        <label htmlFor="key">{k.saved ? 'Replace key' : 'Anthropic API key'}</label>
        <div className="keyrow">
          <input id="key" className="inp" type={show ? 'text' : 'password'} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="sk-ant-…" value={val}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && val.trim() && void save()} />
          <button className="ib" style={{ height: 40, width: 40 }} title={show ? 'Hide' : 'Show'} aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}><Icon n={show ? 'eyeoff' : 'eye'} /></button>
          <button className="btn" style={{ height: 40 }} disabled={!val.trim() || a.keyBusy} onClick={() => void save()}>{a.keyBusy ? 'Checking…' : 'Verify & lock'}</button>
        </div>
        {err && <span className="status no" role="alert"><Icon n="alert" size="s" />{err}</span>}
        {ok && <span className="status ok" role="status"><Icon n="check" size="s" />{ok}</span>}
      </div>

      <div className="field">
        <label htmlFor="model">Model</label>
        <select id="model" className="sel" value={a.data.model} onChange={(e) => a.patch({ model: e.target.value })}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
        </select>
      </div>

      <div className="card" style={{ alignItems: 'flex-start' }}>
        <span className="nic"><Icon n="shield" size="m" /></span>
        <span className="grow"><b>How your key is protected</b>
          <span>It is checked with Anthropic, then encrypted (AES-256-GCM) before it is saved, and tied to your account. It is only decrypted on the server to make a request, and is never sent back to this browser, logged, or included in exports.</span></span>
      </div>
    </>
  );
}

function NotificationsPanel() {
  const a = useApp();
  const p = a.data.notifPrefs;
  const set = (k: keyof Persisted['notifPrefs'], v: boolean) => a.patch({ notifPrefs: { ...p, [k]: v } });
  const denied = a.sysPerm === 'denied';
  return (
    <>
      <h3>Notifications</h3>
      <div className="card"><span className="grow"><b>Replies</b><span>Tell me when Fynro finishes a reply in another chat or while the app is in the background.</span></span><Toggle on={p.replies} label="Reply notifications" onClick={() => set('replies', !p.replies)} /></div>
      <div className="card">
        <span className="grow"><b>Device notifications</b>
          <span>{a.sysPerm === 'unsupported' ? 'Not supported in this browser.' : denied ? 'Blocked. Allow notifications for this site in your browser settings.' : 'Show system notifications when the app is not in view.'}</span></span>
        {a.sysPerm === 'granted'
          ? <Toggle on={p.system} label="Device notifications" onClick={() => set('system', !p.system)} />
          : <button className="btn" disabled={denied || a.sysPerm === 'unsupported'} onClick={() => void a.enableSystemNotifs()}>Enable</button>}
      </div>
    </>
  );
}

export function SettingsModal() {
  const a = useApp();
  const { data } = a;
  const tab = a.settings.tab;

  return (
    <div className="ov mid" style={{ zIndex: 60 }} onClick={a.closeSettings}>
      <div className="modal set pop" role="dialog" aria-modal="true" aria-label="Settings" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button className="ib xbtn" aria-label="Close settings" onClick={a.closeSettings}><Icon n="x" /></button>
        <nav className="set-nav">
          <h2>Settings</h2>
          {TABS.map(([id, label, ic]) => <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => a.openSettings(id)}><Icon n={ic} size="m" />{label}</button>)}
        </nav>
        <div className="set-body">
          {tab === 'general' && (
            <>
              <h3>General</h3>
              <div className="field"><span className="lbl">Signed in as</span><div className="inp" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>{a.user.email}</div></div>
              <div className="field"><label htmlFor="nm">Display name</label><input id="nm" className="inp" maxLength={60} value={data.name} onChange={(e) => a.patch({ name: e.target.value })} /></div>
              <div className="field"><span className="lbl">Response style</span><Seg value={data.style} options={['Concise', 'Balanced', 'Detailed']} onChange={(v) => a.patch({ style: v })} /></div>
              <div className="field"><span className="lbl">Financial year</span><Seg value={data.fy} options={['Apr–Mar', 'Jan–Dec']} onChange={(v) => a.patch({ fy: v })} /></div>
              <div className="field">
                <span className="lbl">App</span>
                <div className="card">
                  <span className="nic"><Icon n="phone" size="m" /></span>
                  <span className="grow"><b>{a.installed ? 'Installed' : 'Install Fynro'}</b><span>{a.installed ? 'You are using the installed app.' : a.canInstall ? 'Add Fynro to your home screen or desktop.' : 'On iPhone, tap Share then “Add to Home Screen”. On desktop, use the install icon in the address bar.'}</span></span>
                  {a.canInstall && <button className="btn" onClick={() => void a.install()}>Install</button>}
                </div>
              </div>
              <div><button className="btn ghost" onClick={() => void a.logout()}><Icon n="logout" size="m" />Log out</button></div>
            </>
          )}
          {tab === 'appearance' && (
            <>
              <h3>Appearance</h3>
              <Seg value={data.theme === 'dark' ? 'Dark' : data.theme === 'light' ? 'Light' : 'System'} options={['Light', 'Dark', 'System']} onChange={(v) => a.setTheme(v.toLowerCase() as Persisted['theme'])} />
              <div className="previews">
                {(['light', 'dark'] as const).map((t) => (
                  <button key={t} className={'pv' + (data.theme === t ? ' on' : '')} onClick={() => a.setTheme(t)} style={{ background: t === 'dark' ? '#0a0a0b' : '#f2f2f4', color: t === 'dark' ? '#f4f4f5' : '#111113' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{t === 'dark' ? 'Dark' : 'Light'}</span>
                    <i style={{ width: '70%', background: t === 'dark' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)' }} />
                    <i style={{ width: '45%', background: t === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)' }} />
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'api' && <ApiKeyPanel />}
          {tab === 'data' && (
            <>
              <h3>Data &amp; privacy</h3>
              <p className="hint" style={{ margin: '-10px 0 0' }}>Chats are stored in this browser for your account only. They are sent to Anthropic when you send a message, under your own API key.</p>
              <div className="card"><span className="grow"><b>Export chats</b><span>Download all chats as JSON. Your API key is never included.</span></span>
                <button className="btn ghost" disabled={!data.chats.length} onClick={() => {
                  const url = URL.createObjectURL(new Blob([JSON.stringify(data.chats.map((c) => ({ ...c, messages: c.messages.map(({ streaming: _s, ...m }) => m) })), null, 2)], { type: 'application/json' }));
                  const l = document.createElement('a'); l.href = url; l.download = 'fynro-chats.json'; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}><Icon n="download" size="m" />Export</button></div>
              <div className="card"><span className="grow"><b>Delete all chats</b><span>Removes every conversation from this device. This cannot be undone.</span></span>
                <button className="btn bad" disabled={!data.chats.length} onClick={() => a.askConfirm({ title: 'Delete all chats?', body: 'Every conversation will be permanently removed from this device.', action: 'Delete all', run: () => { a.deleteAll(); a.flash('All chats deleted'); } })}>Delete</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
