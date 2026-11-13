'use client';

import { useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { MODELS } from '@/lib/seed';
import type { Persisted } from '@/lib/types';

const TABS: [string, string, IconName][] = [
  ['general', 'General', 'user'], ['appearance', 'Appearance', 'palette'], ['connectors', 'Connectors', 'plug'],
  ['notifications', 'Notifications', 'bell'], ['api', 'API key', 'key'], ['data', 'Data & privacy', 'shield'],
];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return <div className="seg" role="radiogroup">{options.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>;
}
const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
  <button className={'tog' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><i /></button>
);

function ApiKeyPanel() {
  const a = useApp();
  const { provider, model } = a.data;
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const saved = !!a.apiKey;
  const masked = saved ? `${a.apiKey.slice(0, 7)}••••••••${a.apiKey.slice(-4)}` : '';
  const placeholder = provider === 'anthropic' ? 'sk-ant-…' : 'sk-…';

  const save = async () => {
    const k = val.trim();
    if (!k) return;
    a.setApiKey(k);
    setVal('');
    await a.testKey(k);
  };

  return (
    <>
      <h3>API key</h3>
      <p className="hint" style={{ margin: '-10px 0 0' }}>Add your own key to get live answers from a model. Without one, Fynro replies with built-in demo answers.</p>

      <div className="field">
        <span className="lbl">Provider</span>
        <Seg value={provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} options={['Anthropic', 'OpenAI']} onChange={(v) => {
          const p = v === 'Anthropic' ? 'anthropic' : 'openai';
          a.patch({ provider: p, model: MODELS[p][0].id });
          setVal(''); setShow(false);
        }} />
      </div>
      <div className="field">
        <label htmlFor="model">Model</label>
        <select id="model" className="sel" value={model} onChange={(e) => a.patch({ model: e.target.value })}>
          {MODELS[provider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="key">{provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key</label>
        {saved && (
          <div className="card">
            <span className="nic" style={{ color: a.keyStatus === 'bad' ? 'var(--bad)' : 'var(--ok)' }}><Icon n={a.keyStatus === 'bad' ? 'alert' : 'check'} size="m" /></span>
            <span className="grow"><b style={{ fontFamily: 'var(--mono)', fontSize: 13.5, fontWeight: 400 }}>{masked}</b>
              <span>{a.keyStatus === 'testing' ? 'Checking…' : a.keyStatus === 'ok' ? 'Key verified' : a.keyStatus === 'bad' ? a.keyError : 'Saved on this device'}</span></span>
            <button className="btn ghost" onClick={() => void a.testKey()} disabled={a.keyStatus === 'testing'}>Test</button>
            <button className="btn bad" onClick={() => { a.setApiKey(''); a.flash('API key removed'); }}>Remove</button>
          </div>
        )}
        <div className="keyrow">
          <input id="key" className="inp" type={show ? 'text' : 'password'} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            placeholder={saved ? 'Paste a new key to replace' : placeholder} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          <button className="ib" style={{ height: 40, width: 40 }} title={show ? 'Hide' : 'Show'} aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}><Icon n={show ? 'eyeoff' : 'eye'} /></button>
          <button className="btn" disabled={!val.trim() || a.keyStatus === 'testing'} onClick={() => void save()} style={{ height: 40 }}>Save</button>
        </div>
        {!saved && a.keyStatus === 'bad' && <span className="status no"><Icon n="alert" size="s" />{a.keyError}</span>}
        {a.serverKey && !saved && <span className="status ok"><Icon n="check" size="s" />This workspace has a shared key, so live replies already work.</span>}
      </div>

      <div className="card" style={{ alignItems: 'flex-start' }}>
        <span className="nic"><Icon n="shield" size="m" /></span>
        <span className="grow"><b>How your key is handled</b>
          <span>It is stored only in this browser. Each message sends it to this app’s server, which forwards it to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} and never saves or logs it. Anyone with access to this browser profile can read it, so remove it on shared devices.</span></span>
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
      <div className="card"><span className="grow"><b>Money alerts</b><span>Duplicate charges, overdue invoices and filing deadlines.</span></span><Toggle on={p.alerts} label="Money alerts" onClick={() => set('alerts', !p.alerts)} /></div>
      <div className="card">
        <span className="grow"><b>Device notifications</b>
          <span>{a.sysPerm === 'unsupported' ? 'Not supported in this browser.' : denied ? 'Blocked. Allow notifications for this site in your browser settings.' : 'Show system notifications when the app is not in view.'}</span></span>
        {a.sysPerm === 'granted'
          ? <Toggle on={p.system} label="Device notifications" onClick={() => set('system', !p.system)} />
          : <button className="btn" disabled={denied || a.sysPerm === 'unsupported'} onClick={() => void a.enableSystemNotifs()}>Enable</button>}
      </div>
      <div><button className="btn ghost" onClick={() => a.notify({ kind: 'info', title: 'Test notification', body: 'This is how Fynro alerts will look.' })}>Send a test</button></div>
    </>
  );
}

export function SettingsModal() {
  const a = useApp();
  const { data } = a;
  const tab = a.settings.tab;
  const Row = ({ c }: { c: Persisted['connectors'][number] }) => (
    <div className="card">
      {c.id === 'gmail' ? <span className="ctile w" style={{ width: 36, height: 36 }}><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M1.6 21h3.8v-9.3L0 7.7v11.7C0 20.3.7 21 1.6 21z" /><path fill="#34A853" d="M18.6 21h3.8c.9 0 1.6-.7 1.6-1.6V7.7l-5.4 4z" /><path fill="#FBBC04" d="M18.6 3.7v8l5.4-4V5.3c0-2-2.3-3.1-3.9-1.9z" /><path fill="#EA4335" d="M5.4 11.7v-8L12 8.6l6.6-4.9v8L12 16.6z" /><path fill="#C5221F" d="M0 5.3v2.4l5.4 4v-8L3.9 3.4C2.3 2.2 0 3.3 0 5.3z" /></svg></span> : <Logo size={36} radius={10} />}
      <span className="grow"><b>{c.name}</b><span>{c.connected && <i className="on-dot" />}{c.desc}</span></span>
      <button className={'btn' + (c.connected ? ' ghost' : '')} onClick={() => {
        a.patch({ connectors: data.connectors.map((x) => (x.id === c.id ? { ...x, connected: !x.connected, active: !x.connected } : x)) });
        if (!c.connected) a.notify({ kind: 'success', title: `${c.name} connected`, body: 'Fynro can now use it as a source.' });
      }}>{c.connected ? 'Disconnect' : 'Connect'}</button>
    </div>
  );
  const [cq, setCq] = useState('');

  return (
    <div className="ov mid" style={{ zIndex: 60 }} onClick={a.closeSettings}>
      <div className="modal set pop" role="dialog" aria-modal="true" aria-label="Settings" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button className="ib xbtn" aria-label="Close settings" onClick={a.closeSettings}><Icon n="x" /></button>
        <nav className="set-nav">
          <h2>Settings</h2>
          {TABS.map(([id, label, ic]) => <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => a.openSettings(id as any)}><Icon n={ic} size="m" />{label}</button>)}
        </nav>
        <div className="set-body">
          {tab === 'general' && (
            <>
              <h3>General</h3>
              <div className="field"><label htmlFor="nm">Display name</label><input id="nm" className="inp" value={data.name} onChange={(e) => a.patch({ name: e.target.value })} /></div>
              <div className="field"><span className="lbl">Response style</span><Seg value={data.style} options={['Concise', 'Balanced', 'Detailed']} onChange={(v) => a.patch({ style: v })} /></div>
              <div className="field"><span className="lbl">Financial year</span><Seg value={data.fy} options={['Apr–Mar', 'Jan–Dec']} onChange={(v) => a.patch({ fy: v })} /></div>
              <div className="field">
                <span className="lbl">App</span>
                <div className="card">
                  <span className="nic"><Icon n="phone" size="m" /></span>
                  <span className="grow"><b>{a.installed ? 'Installed' : 'Install Fynro'}</b><span>{a.installed ? 'You are using the installed app.' : a.canInstall ? 'Add Fynro to your home screen or desktop. Works offline.' : 'On iPhone, tap Share then “Add to Home Screen”. On desktop, use the install icon in the address bar.'}</span></span>
                  {a.canInstall && <button className="btn" onClick={() => void a.install()}>Install</button>}
                </div>
              </div>
            </>
          )}
          {tab === 'appearance' && (
            <>
              <h3>Appearance</h3>
              <Seg value={data.theme === 'dark' ? 'Dark' : data.theme === 'light' ? 'Light' : 'System'} options={['Light', 'Dark', 'System']} onChange={(v) => a.setTheme(v.toLowerCase() as Persisted['theme'])} />
              <div className="previews">
                {(['light', 'dark'] as const).map((t) => (
                  <button key={t} className={'pv' + ((data.theme === t) ? ' on' : '')} onClick={() => a.setTheme(t)} style={{ background: t === 'dark' ? '#0a0a0b' : '#f2f2f4', color: t === 'dark' ? '#f4f4f5' : '#111113' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{t === 'dark' ? 'Dark' : 'Light'}</span>
                    <i style={{ width: '70%', background: t === 'dark' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)' }} />
                    <i style={{ width: '45%', background: t === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)' }} />
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'connectors' && (
            <>
              <h3>Connectors</h3>
              <input className="inp" placeholder="Search connectors" aria-label="Search connectors" value={cq} onChange={(e) => setCq(e.target.value)} />
              {data.connectors.filter((c) => !cq || c.name.toLowerCase().includes(cq.toLowerCase())).map((c) => <Row key={c.id} c={c} />)}
            </>
          )}
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'api' && <ApiKeyPanel />}
          {tab === 'data' && (
            <>
              <h3>Data &amp; privacy</h3>
              <div className="card"><span className="grow"><b>Export chats</b><span>Download all chats as JSON. Your API key is never included.</span></span>
                <button className="btn ghost" onClick={() => {
                  const url = URL.createObjectURL(new Blob([JSON.stringify(data.chats, null, 2)], { type: 'application/json' }));
                  const l = document.createElement('a'); l.href = url; l.download = 'fynro-chats.json'; l.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}><Icon n="download" size="m" />Export</button></div>
              <div className="card"><span className="grow"><b>Disconnect all</b><span>Remove every connected source.</span></span>
                <button className="btn ghost" onClick={() => { a.patch({ connectors: data.connectors.map((c) => ({ ...c, connected: false, active: false })) }); a.flash('All connectors disconnected'); }}>Disconnect</button></div>
              <div className="card"><span className="grow"><b>Delete all chats</b><span>This cannot be undone.</span></span>
                <button className="btn bad" onClick={() => a.askConfirm({ title: 'Delete all chats?', body: 'Every conversation will be permanently removed from this device.', action: 'Delete all', run: () => { a.deleteAll(); a.flash('All chats deleted'); } })}>Delete</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
