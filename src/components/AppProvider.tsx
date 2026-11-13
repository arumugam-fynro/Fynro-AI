'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaults } from '@/lib/seed';
import { makeReply } from '@/lib/reply';
import { API_KEY_STORE, STORE_KEY, uid } from '@/lib/util';
import type { Attachment, Chat, Message, Notif, NotifKind, Persisted } from '@/lib/types';

type Toast = { id: string; kind: NotifKind; title: string; body?: string; chatId?: string };
type Tab = 'general' | 'appearance' | 'connectors' | 'notifications' | 'api' | 'data';
type KeyStatus = 'idle' | 'testing' | 'ok' | 'bad';

export type Ctx = {
  data: Persisted;
  patch: (p: Partial<Persisted>) => void;
  hydrated: boolean;
  dark: boolean;
  setTheme: (t: Persisted['theme']) => void;
  toggleTheme: () => void;
  // chats
  active: Chat | null;
  pending: boolean;
  newChat: () => void;
  openChat: (id: string) => void;
  updateChat: (id: string, fn: (c: Chat) => Chat) => void;
  deleteChat: (id: string) => void;
  deleteAll: () => void;
  send: (text: string, atts: Attachment[], opts: { research: boolean; memory: boolean }) => void;
  retry: () => void;
  stop: () => void;
  activeSources: (research: boolean) => string[];
  // ui
  sbd: boolean; sbm: boolean; toggleSidebar: () => void; closeMobileSidebar: () => void;
  settings: { open: boolean; tab: Tab }; openSettings: (tab?: Tab) => void; closeSettings: () => void;
  searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  notifOpen: boolean; setNotifOpen: (v: boolean) => void;
  confirm: { title: string; body: string; action: string; run: () => void } | null;
  askConfirm: (c: Ctx['confirm']) => void;
  flash: (msg: string) => void;
  snack: string | null;
  // notifications
  notify: (n: { kind?: NotifKind; title: string; body?: string; chatId?: string }) => void;
  toasts: Toast[]; dismissToast: (id: string) => void;
  markRead: (id: string) => void; markAllRead: () => void; clearNotifs: () => void;
  unread: number;
  sysPerm: NotificationPermission | 'unsupported';
  enableSystemNotifs: () => Promise<void>;
  // api key
  serverKey: boolean;
  apiKey: string; setApiKey: (k: string) => void; keyStatus: KeyStatus; keyError: string; testKey: (k?: string) => Promise<void>;
  // pwa
  canInstall: boolean; install: () => Promise<void>; installed: boolean; online: boolean;
};

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error('useApp outside provider');
  return v;
};

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

function systemPrompt(d: Persisted, sources: string[]) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const style = { Concise: 'Keep answers short and direct.', Balanced: 'Be clear and reasonably brief.', Detailed: 'Give thorough, step-by-step answers.' }[d.style];
  return [
    `You are Fynro, an AI finance assistant for ${d.name}, who lives in India.`,
    `Today is ${today}. The user's financial year runs ${d.fy === 'Apr–Mar' ? 'April to March' : 'January to December'}.`,
    style,
    'Use ₹ and Indian digit grouping (e.g. ₹2,86,000). Reply in plain text only: no markdown, no tables, no asterisks. Use short paragraphs or numbered lines.',
    sources.length
      ? `The user enabled these sources: ${sources.join(', ')}. You cannot actually query them in this session, so never invent account balances, transactions or invoices; ask for figures or explain how to find them.`
      : 'No data sources are connected. Never invent account figures; give general guidance and say what data would help.',
    'You are not a licensed adviser. Flag when a decision needs a CA or SEBI-registered adviser.',
  ].join('\n');
}

const toApi = (c: Chat): { role: 'user' | 'assistant'; content: string }[] =>
  c.messages
    .filter((m) => !m.error && (m.text || m.attachments?.length))
    .map((m) => ({
      role: m.role,
      content: [m.text, [m.note].filter(Boolean).join(''), ...(m.attachments || []).map((a) => `[Attached ${a.kind}: ${a.name}]`)].filter(Boolean).join('\n'),
    }));

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const [sysDark, setSysDark] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sbd, setSbd] = useState(true);
  const [sbm, setSbm] = useState(false);
  const [settings, setSettings] = useState<Ctx['settings']>({ open: false, tab: 'general' });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirm, setConfirm] = useState<Ctx['confirm']>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sysPerm, setSysPerm] = useState<Ctx['sysPerm']>('unsupported');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [keyError, setKeyError] = useState('');
  const [installEv, setInstallEv] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [serverKeys, setServerKeys] = useState<{ anthropic: boolean; openai: boolean }>({ anthropic: false, openai: false });
  const serverRef = useRef(serverKeys);
  serverRef.current = serverKeys;

  const ref = useRef(data);
  ref.current = data;
  const apiKey = keys[data.provider] || '';
  const keyRef = useRef(apiKey);
  keyRef.current = apiKey;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const abort = useRef<AbortController | null>(null);
  const snackT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ---- hydrate once ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Partial<Persisted>;
      const base = defaults();
      const chats = (saved.chats || base.chats).map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }));
      setData({
        ...base, ...saved, chats,
        connectors: saved.connectors?.[0]?.id === 'fynro' ? saved.connectors : base.connectors,
        notifs: saved.notifs || base.notifs,
        notifPrefs: { ...base.notifPrefs, ...saved.notifPrefs },
        activeId: saved.activeId === undefined ? base.activeId : saved.activeId,
      });
    } catch {}
    try {
      const raw = localStorage.getItem(API_KEY_STORE) || '';
      setKeys(raw.startsWith('{') ? JSON.parse(raw) : raw ? { anthropic: raw } : {});
    } catch {}
    setSbd(window.innerWidth >= 768);
    fetch('/api/chat').then((r) => r.json()).then(setServerKeys).catch(() => {});
    setHydrated(true);
    setOnline(navigator.onLine);
    setSysPerm('Notification' in window ? Notification.permission : 'unsupported');
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  }, []);

  // ---- persist (debounced) ----
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [data, hydrated]);

  // ---- theme ----
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const dark = data.theme === 'dark' || (data.theme === 'system' && sysDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#050506' : '#e7e7ea');
  }, [dark]);

  // ---- online / install / sw messages / shortcuts ----
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    const bip = (e: Event) => { e.preventDefault(); setInstallEv(e); };
    const inst = () => { setInstalled(true); setInstallEv(null); };
    window.addEventListener('online', up); window.addEventListener('offline', down);
    window.addEventListener('beforeinstallprompt', bip); window.addEventListener('appinstalled', inst);
    const onSw = (e: MessageEvent) => { if (e.data?.type === 'open-chat' && e.data.chatId) { openChatRef.current(e.data.chatId); setNotifOpen(false); } };
    navigator.serviceWorker?.addEventListener('message', onSw);
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setSettings((s) => ({ ...s, open: false })); setConfirm(null); setNotifOpen(false); }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('online', up); window.removeEventListener('offline', down);
      window.removeEventListener('beforeinstallprompt', bip); window.removeEventListener('appinstalled', inst);
      navigator.serviceWorker?.removeEventListener('message', onSw);
      window.removeEventListener('keydown', key);
    };
  }, []);

  useEffect(() => { setKeyStatus('idle'); setKeyError(''); }, [data.provider]);

  // ---- helpers ----
  const patch = useCallback((p: Partial<Persisted>) => setData((d) => ({ ...d, ...p })), []);
  const flash = useCallback((msg: string) => {
    clearTimeout(snackT.current);
    setSnack(msg);
    snackT.current = setTimeout(() => setSnack(null), 2200);
  }, []);
  const updateChat = useCallback((id: string, fn: (c: Chat) => Chat) => setData((d) => ({ ...d, chats: d.chats.map((c) => (c.id === id ? fn(c) : c)) })), []);

  const notify: Ctx['notify'] = useCallback(({ kind = 'info', title, body, chatId }) => {
    if (kind === 'alert' && !ref.current.notifPrefs.alerts) return;
    const n: Notif = { id: uid(), kind, title, body, chatId, at: Date.now(), read: false };
    setData((d) => ({ ...d, notifs: [n, ...d.notifs].slice(0, 60) }));
    setToasts((t) => [...t.slice(-2), { id: n.id, kind, title, body, chatId }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 5500);
    // OS-level notification only when the tab is not in view
    const p = ref.current.notifPrefs;
    if (p.system && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then((reg) =>
        reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: n.id, data: { chatId } })
      ).catch(() => {});
    }
  }, []);

  // Surface the newest unread money alert once per session as an in-app toast.
  const alertShown = useRef(false);
  useEffect(() => {
    if (!hydrated || alertShown.current) return;
    const n = ref.current.notifs.find((x) => x.kind === 'alert' && !x.read);
    if (n && ref.current.notifPrefs.alerts) {
      const id = n.id;
      const t = setTimeout(() => {
        alertShown.current = true;
        setToasts((ts) => [...ts, { id, kind: n.kind, title: n.title, body: n.body, chatId: n.chatId }]);
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [hydrated]);

  const enableSystemNotifs = useCallback(async () => {
    if (!('Notification' in window)) return flash('Notifications are not supported here');
    const r = await Notification.requestPermission();
    setSysPerm(r);
    if (r === 'granted') {
      setData((d) => ({ ...d, notifPrefs: { ...d.notifPrefs, system: true } }));
      notify({ kind: 'success', title: 'Device notifications on', body: 'You will be alerted when Fynro replies while this app is in the background.' });
    } else flash('Permission was not granted');
  }, [flash, notify]);

  // ---- chats ----
  const active = useMemo(() => data.chats.find((c) => c.id === data.activeId) || null, [data.chats, data.activeId]);

  const openChat = useCallback((id: string) => {
    setData((d) => ({ ...d, activeId: id }));
    if (isMobile()) setSbm(false);
  }, []);
  const openChatRef = useRef(openChat);
  openChatRef.current = openChat;

  const newChat = useCallback(() => {
    setData((d) => ({ ...d, activeId: null }));
    setSearchOpen(false);
    if (isMobile()) setSbm(false);
  }, []);

  const deleteChat = useCallback((id: string) => setData((d) => ({ ...d, chats: d.chats.filter((c) => c.id !== id), activeId: d.activeId === id ? null : d.activeId })), []);
  const deleteAll = useCallback(() => setData((d) => ({ ...d, chats: [], activeId: null })), []);

  const activeSources = useCallback((research: boolean) => {
    const a = ref.current.connectors.filter((c) => c.connected && c.active).map((c) => c.name);
    return research ? [...a, 'the web'] : a;
  }, []);

  const respond = useCallback(async (id: string, text: string, atts: Attachment[], research: boolean) => {
    const sources = activeSources(research);
    const finish = (final: Message) => {
      updateChat(id, (c) => {
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && last.streaming) msgs[msgs.length - 1] = { ...last, ...final, streaming: false };
        else msgs.push(final);
        return { ...c, updated: Date.now(), messages: msgs };
      });
      setPendingId(null);
      const d = ref.current;
      const away = document.hidden || d.activeId !== id;
      if (d.notifPrefs.replies && away && !final.error) {
        notify({ kind: 'reply', title: 'Fynro replied', body: final.text.replace(/\s+/g, ' ').slice(0, 110), chatId: id });
      }
    };

    const key = keyRef.current;
    if (!key && !serverRef.current[ref.current.provider]) {
      // Offline demo mode: canned keyword replies, same as the original design.
      await new Promise((r) => setTimeout(r, 1000));
      let r: Pick<Message, 'text' | 'table' | 'note'> = makeReply(text, sources);
      if (atts.length) {
        const names = atts.map((a) => a.name).join(', ');
        r = text ? { ...r, text: `I read ${names} alongside your accounts.\n\n${r.text}` } : { text: `I read ${names}. Do you want a summary, the key amounts and due dates, or a check against your accounts?` };
      }
      finish({ role: 'assistant', sources, ...r });
      return;
    }

    const ctl = new AbortController();
    abort.current = ctl;
    let acc = '';
    let raf = 0;
    const flush = () => {
      raf = 0;
      updateChat(id, (c) => {
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && last.streaming) msgs[msgs.length - 1] = { ...last, text: acc };
        else msgs.push({ role: 'assistant', text: acc, sources, streaming: true });
        return { ...c, messages: msgs };
      });
    };
    try {
      const chat = ref.current.chats.find((c) => c.id === id);
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-user-api-key': key },
        body: JSON.stringify({ provider: ref.current.provider, model: ref.current.model, system: systemPrompt(ref.current, sources), messages: chat ? toApi(chat) : [] }),
      });
      if (!res.ok || !res.body) {
        let msg = 'Something went wrong.';
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        if (!raf) raf = requestAnimationFrame(flush);
      }
      if (raf) cancelAnimationFrame(raf);
      finish({ role: 'assistant', text: acc.trim() || 'The model returned an empty reply.', sources });
    } catch (e: any) {
      if (raf) cancelAnimationFrame(raf);
      if (e?.name === 'AbortError') {
        if (acc) finish({ role: 'assistant', text: acc.trim(), sources });
        else setPendingId(null);
        return;
      }
      const msg = e?.message === 'Failed to fetch' ? 'You appear to be offline. Check your connection and retry.' : e?.message || 'Something went wrong.';
      finish({ role: 'assistant', text: msg, error: true });
    } finally {
      abort.current = null;
    }
  }, [activeSources, notify, updateChat]);

  const send: Ctx['send'] = useCallback((text, atts, opts) => {
    text = text.trim();
    if ((!text && !atts.length) || pendingId) return;
    const msg: Message = { role: 'user', text, attachments: atts.length ? atts : undefined };
    let id = ref.current.activeId;
    if (!id || !ref.current.chats.some((c) => c.id === id)) {
      id = 'c' + Date.now();
      const t0 = text || atts[0].name;
      const chat: Chat = { id, title: t0.length > 42 ? t0.slice(0, 40).trim() + '…' : t0, pinned: false, updated: Date.now(), messages: [msg] };
      setData((d) => ({ ...d, chats: [chat, ...d.chats], activeId: id }));
      ref.current = { ...ref.current, chats: [chat, ...ref.current.chats], activeId: id };
    } else {
      updateChat(id, (c) => ({ ...c, updated: Date.now(), messages: [...c.messages, msg] }));
      ref.current = { ...ref.current, chats: ref.current.chats.map((c) => (c.id === id ? { ...c, messages: [...c.messages, msg] } : c)) };
    }
    setPendingId(id);
    void respond(id, text, atts, opts.research);
  }, [pendingId, respond, updateChat]);

  const retry = useCallback(() => {
    const c = ref.current.chats.find((x) => x.id === ref.current.activeId);
    if (!c || pendingId) return;
    const msgs = [...c.messages];
    if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    updateChat(c.id, (x) => ({ ...x, messages: msgs }));
    ref.current = { ...ref.current, chats: ref.current.chats.map((x) => (x.id === c.id ? { ...x, messages: msgs } : x)) };
    setPendingId(c.id);
    void respond(c.id, lastUser.text, lastUser.attachments || [], false);
  }, [pendingId, respond, updateChat]);

  const stop = useCallback(() => abort.current?.abort(), []);

  // ---- notifications ----
  const markRead = useCallback((id: string) => setData((d) => ({ ...d, notifs: d.notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) })), []);
  const markAllRead = useCallback(() => setData((d) => ({ ...d, notifs: d.notifs.map((n) => ({ ...n, read: true })) })), []);
  const clearNotifs = useCallback(() => setData((d) => ({ ...d, notifs: [] })), []);
  const unread = useMemo(() => data.notifs.filter((n) => !n.read).length, [data.notifs]);

  // App badge for installed PWAs
  useEffect(() => {
    const nav = navigator as any;
    if (!hydrated || !nav.setAppBadge) return;
    (unread ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch?.(() => {});
  }, [unread, hydrated]);

  // ---- API key ----
  const setApiKey = useCallback((k: string) => {
    k = k.trim();
    const next = { ...keysRef.current, [ref.current.provider]: k };
    if (!k) delete next[ref.current.provider];
    keysRef.current = next;
    setKeys(next);
    setKeyStatus('idle');
    setKeyError('');
    try { Object.keys(next).length ? localStorage.setItem(API_KEY_STORE, JSON.stringify(next)) : localStorage.removeItem(API_KEY_STORE); } catch {}
  }, []);

  const testKey = useCallback(async (k?: string) => {
    const key = (k ?? keyRef.current).trim();
    if (!key) return;
    setKeyStatus('testing');
    setKeyError('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-api-key': key },
        body: JSON.stringify({ action: 'test', provider: ref.current.provider, model: ref.current.model }),
      });
      if (!res.ok) {
        let m = 'Key check failed.';
        try { m = (await res.json()).error || m; } catch {}
        throw new Error(m);
      }
      setKeyStatus('ok');
    } catch (e: any) {
      setKeyStatus('bad');
      setKeyError(e?.message === 'Failed to fetch' ? 'You appear to be offline.' : e?.message || 'Key check failed.');
    }
  }, []);

  // ---- pwa ----
  const install = useCallback(async () => {
    if (!installEv) return;
    installEv.prompt();
    await installEv.userChoice.catch(() => {});
    setInstallEv(null);
  }, [installEv]);

  const value: Ctx = {
    data, patch, hydrated, dark,
    setTheme: (t) => patch({ theme: t }),
    toggleTheme: () => patch({ theme: dark ? 'light' : 'dark' }),
    active, pending: !!pendingId, newChat, openChat, updateChat, deleteChat, deleteAll, send, retry, stop, activeSources,
    sbd, sbm,
    toggleSidebar: () => (isMobile() ? setSbm((v) => !v) : setSbd((v) => !v)),
    closeMobileSidebar: () => setSbm(false),
    settings, openSettings: (tab = 'general') => { setSettings({ open: true, tab }); setNotifOpen(false); setSbm(false); },
    closeSettings: () => setSettings((s) => ({ ...s, open: false })),
    searchOpen, setSearchOpen, notifOpen, setNotifOpen,
    confirm, askConfirm: setConfirm, flash, snack,
    notify, toasts, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    markRead, markAllRead, clearNotifs, unread, sysPerm, enableSystemNotifs,
    serverKey: serverKeys[data.provider], apiKey, setApiKey, keyStatus, keyError, testKey,
    canInstall: !!installEv, install, installed, online,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
