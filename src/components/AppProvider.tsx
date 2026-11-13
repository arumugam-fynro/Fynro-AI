'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaults } from '@/lib/seed';
import { DEFAULT_MODEL, MODELS } from '@/lib/models';
import { LEGACY_PREFIXES, STORE_KEY, THEME_KEY, uid } from '@/lib/util';
import { logout as logoutAction } from '@/app/actions';
import type { Attachment, Chat, Message, Notif, NotifKind, Persisted } from '@/lib/types';

type Toast = { id: string; kind: NotifKind; title: string; body?: string; chatId?: string };
export type Tab = 'general' | 'appearance' | 'notifications' | 'api' | 'data';
export type KeyInfo = { loaded: boolean; saved: boolean; hint: string | null; updatedAt: string | null; ready: boolean; serverKey: boolean };
type ApiErr = Error & { code?: string };

export type Ctx = {
  user: { id: string; email: string };
  logout: () => Promise<void>;
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
  send: (text: string, atts: Attachment[]) => boolean;
  retry: () => void;
  stop: () => void;
  // ui
  sbd: boolean; sbm: boolean; toggleSidebar: () => void;
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
  // API key (stored encrypted on the server; the browser only ever sees a masked hint)
  keyInfo: KeyInfo;
  keyBusy: boolean;
  saveApiKey: (key: string) => Promise<string | null>;
  removeApiKey: () => Promise<string | null>;
  testApiKey: () => Promise<string | null>;
  hasKey: boolean;
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

function systemPrompt(d: Persisted) {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const style = { Concise: 'Keep answers short and direct.', Balanced: 'Be clear and reasonably brief.', Detailed: 'Give thorough, step-by-step answers.' }[d.style];
  return [
    `You are Fynro, an AI finance assistant${d.name ? ` for ${d.name}` : ''}, who lives in India.`,
    `Today is ${today}. The user's financial year runs ${d.fy === 'Apr–Mar' ? 'April to March' : 'January to December'}.`,
    style,
    'Use ₹ and Indian digit grouping (e.g. ₹2,86,000). Reply in plain text only: no markdown, no tables, no asterisks. Use short paragraphs or numbered lines.',
    "You cannot see the user's bank accounts or transactions. Never invent balances, transactions, invoices or tax figures; work from what the user tells you or attaches, and say what data would help.",
    'You are not a licensed adviser. Flag when a decision needs a CA or a SEBI-registered adviser.',
  ].join('\n');
}

/** History for the API. Text-file contents are inlined for the turn they were attached. */
const toApi = (c: Chat) =>
  c.messages
    .filter((m) => !m.error && (m.text || m.attachments?.length))
    .map((m) => ({
      role: m.role,
      content: [
        m.text,
        ...(m.attachments || []).map((a) => (a.text ? `[File: ${a.name}]\n${a.text}` : a.file ? '' : `[Attached ${a.kind}: ${a.name} (contents unavailable)]`)),
      ].filter(Boolean).join('\n\n'),
    }))
    .filter((m) => m.content);

/** Strip in-memory-only fields before anything is written to localStorage. */
const slim = (d: Persisted): Persisted => ({
  ...d,
  chats: d.chats.map((c) => ({
    ...c,
    messages: c.messages.map((m) => (m.attachments ? { ...m, attachments: m.attachments.map(({ file: _f, text: _t, ...a }) => a) } : m)),
  })),
});

const fail = (msg: string, code?: string): never => {
  throw Object.assign(new Error(msg), { code }) as ApiErr;
};

export function AppProvider({ children, user }: { children: ReactNode; user: { id: string; email: string } }) {
  // Chats are namespaced per user so accounts sharing a browser never see each other's data.
  const storeKey = `${STORE_KEY}:${user.id}`;

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
  const [keyInfo, setKeyInfo] = useState<KeyInfo>({ loaded: false, saved: false, hint: null, updatedAt: null, ready: true, serverKey: false });
  const [keyBusy, setKeyBusy] = useState(false);
  const [installEv, setInstallEv] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);

  const ref = useRef(data);
  ref.current = data;
  const infoRef = useRef(keyInfo);
  infoRef.current = keyInfo;
  const abort = useRef<AbortController | null>(null);
  const snackT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openChatRef = useRef<(id: string) => void>(() => {});

  // ---- API key status (server-side, encrypted) ----
  const refreshKey = useCallback(async () => {
    try {
      const r = await fetch('/api/key', { cache: 'no-store' });
      if (r.ok) setKeyInfo({ loaded: true, ...(await r.json()) });
      else setKeyInfo((k) => ({ ...k, loaded: true }));
    } catch {
      setKeyInfo((k) => ({ ...k, loaded: true }));
    }
  }, []);

  // ---- hydrate once ----
  useEffect(() => {
    try {
      // Remove sample data and any browser-stored API keys left by earlier builds.
      Object.keys(localStorage).filter((k) => LEGACY_PREFIXES.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
      const saved = JSON.parse(localStorage.getItem(storeKey) || '{}') as Partial<Persisted>;
      const base = defaults();
      const nm = user.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const chats = (saved.chats || []).map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }));
      setData({
        ...base, name: nm, ...saved, chats,
        model: MODELS.some((m) => m.id === saved.model) ? (saved.model as string) : DEFAULT_MODEL,
        notifs: saved.notifs || [],
        notifPrefs: { ...base.notifPrefs, ...saved.notifPrefs },
        activeId: chats.some((c) => c.id === saved.activeId) ? (saved.activeId as string) : null,
      });
    } catch {}
    setSbd(window.innerWidth >= 768);
    setHydrated(true);
    setOnline(navigator.onLine);
    setSysPerm('Notification' in window ? Notification.permission : 'unsupported');
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    void refreshKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- persist (debounced) ----
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(storeKey, JSON.stringify(slim(data))); localStorage.setItem(THEME_KEY, data.theme); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [data, hydrated, storeKey]);

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

  // ---- helpers ----
  const patch = useCallback((p: Partial<Persisted>) => setData((d) => ({ ...d, ...p })), []);
  const flash = useCallback((msg: string) => {
    clearTimeout(snackT.current);
    setSnack(msg);
    snackT.current = setTimeout(() => setSnack(null), 2600);
  }, []);
  const updateChat = useCallback((id: string, fn: (c: Chat) => Chat) => setData((d) => ({ ...d, chats: d.chats.map((c) => (c.id === id ? fn(c) : c)) })), []);

  const notify: Ctx['notify'] = useCallback(({ kind = 'info', title, body, chatId }) => {
    const n: Notif = { id: uid(), kind, title, body, chatId, at: Date.now(), read: false };
    setData((d) => ({ ...d, notifs: [n, ...d.notifs].slice(0, 60) }));
    setToasts((t) => [...t.slice(-2), { id: n.id, kind, title, body, chatId }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 5500);
    // OS-level notification only when the tab is not in view
    if (ref.current.notifPrefs.system && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then((reg) =>
        reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: n.id, data: { chatId } })
      ).catch(() => {});
    }
  }, []);

  const enableSystemNotifs = useCallback(async () => {
    if (!('Notification' in window)) return flash('Notifications are not supported here');
    const r = await Notification.requestPermission();
    setSysPerm(r);
    if (r === 'granted') {
      setData((d) => ({ ...d, notifPrefs: { ...d.notifPrefs, system: true } }));
      notify({ kind: 'success', title: 'Device notifications on', body: 'You will be alerted when Fynro replies while this app is in the background.' });
    } else flash('Permission was not granted');
  }, [flash, notify]);

  // ---- API key actions ----
  const call = useCallback(async (method: string, body?: unknown): Promise<string | null> => {
    setKeyBusy(true);
    try {
      const r = await fetch('/api/key', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!r.ok) {
        let m = 'Something went wrong.';
        try { m = (await r.json()).error || m; } catch {}
        return m;
      }
      await refreshKey();
      return null;
    } catch {
      return 'You appear to be offline.';
    } finally {
      setKeyBusy(false);
    }
  }, [refreshKey]);
  const saveApiKey = useCallback((key: string) => call('PUT', { key }), [call]);
  const removeApiKey = useCallback(() => call('DELETE'), [call]);
  const testApiKey = useCallback(() => call('POST'), [call]);
  const hasKey = keyInfo.saved || keyInfo.serverKey;

  // ---- chats ----
  const active = useMemo(() => data.chats.find((c) => c.id === data.activeId) || null, [data.chats, data.activeId]);

  const openChat = useCallback((id: string) => {
    setData((d) => ({ ...d, activeId: id }));
    if (isMobile()) setSbm(false);
  }, []);
  openChatRef.current = openChat;

  const newChat = useCallback(() => {
    setData((d) => ({ ...d, activeId: null }));
    setSearchOpen(false);
    if (isMobile()) setSbm(false);
  }, []);

  const deleteChat = useCallback((id: string) => setData((d) => ({ ...d, chats: d.chats.filter((c) => c.id !== id), activeId: d.activeId === id ? null : d.activeId })), []);
  const deleteAll = useCallback(() => setData((d) => ({ ...d, chats: [], activeId: null })), []);

  const respond = useCallback(async (id: string, atts: Attachment[]) => {
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
      if (d.notifPrefs.replies && (document.hidden || d.activeId !== id) && !final.error) {
        notify({ kind: 'reply', title: 'Fynro replied', body: final.text.replace(/\s+/g, ' ').slice(0, 110), chatId: id });
      }
    };

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
        else msgs.push({ role: 'assistant', text: acc, streaming: true });
        return { ...c, messages: msgs };
      });
    };
    try {
      const chat = ref.current.chats.find((c) => c.id === id);
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ref.current.model,
          system: systemPrompt(ref.current),
          messages: chat ? toApi(chat) : [],
          files: atts.filter((a) => a.file).map((a) => ({ name: a.name, mime: a.file!.mime, data: a.file!.data })),
        }),
      });
      if (!res.ok || !res.body) {
        let msg = 'Something went wrong.';
        let code: string | undefined;
        try { const j = await res.json(); msg = j.error || msg; code = j.code; } catch {}
        if (res.status === 401 && !code) { window.location.assign('/login'); return; } // session expired
        fail(msg, code);
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        if (!raf) raf = requestAnimationFrame(flush);
      }
      if (raf) cancelAnimationFrame(raf);
      finish({ role: 'assistant', text: acc.trim() || 'The model returned an empty reply.' });
    } catch (e: any) {
      if (raf) cancelAnimationFrame(raf);
      if (e?.name === 'AbortError') {
        if (acc) finish({ role: 'assistant', text: acc.trim() });
        else setPendingId(null);
        return;
      }
      if (e?.code === 'no_key' || e?.code === 'bad_key') { void refreshKey(); setSettings({ open: true, tab: 'api' }); }
      finish({ role: 'assistant', text: e?.message === 'Failed to fetch' ? 'You appear to be offline. Check your connection and retry.' : e?.message || 'Something went wrong.', error: true });
    } finally {
      abort.current = null;
    }
  }, [notify, updateChat, refreshKey]);

  const send: Ctx['send'] = useCallback((text, atts) => {
    text = text.trim();
    if ((!text && !atts.length) || pendingId) return false;
    if (!infoRef.current.saved && !infoRef.current.serverKey) {
      setSettings({ open: true, tab: 'api' });
      flash('Add your Anthropic API key to start chatting');
      return false;
    }
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
    void respond(id, atts);
    return true;
  }, [pendingId, respond, updateChat, flash]);

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
    void respond(c.id, lastUser.attachments || []);
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

  // ---- pwa ----
  const install = useCallback(async () => {
    if (!installEv) return;
    installEv.prompt();
    await installEv.userChoice.catch(() => {});
    setInstallEv(null);
  }, [installEv]);

  const logout = useCallback(async () => {
    abort.current?.abort();
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear-cache' }); // drop cached app shell
    try { await logoutAction(); } catch {}
    window.location.assign('/login');                                          // hard navigation wipes memory
  }, []);

  const value: Ctx = {
    user, logout,
    data, patch, hydrated, dark,
    setTheme: (t) => patch({ theme: t }),
    toggleTheme: () => patch({ theme: dark ? 'light' : 'dark' }),
    active, pending: !!pendingId, newChat, openChat, updateChat, deleteChat, deleteAll, send, retry, stop,
    sbd, sbm,
    toggleSidebar: () => (isMobile() ? setSbm((v) => !v) : setSbd((v) => !v)),
    settings, openSettings: (tab = 'general') => { setSettings({ open: true, tab }); setNotifOpen(false); setSbm(false); },
    closeSettings: () => setSettings((s) => ({ ...s, open: false })),
    searchOpen, setSearchOpen, notifOpen, setNotifOpen,
    confirm, askConfirm: setConfirm, flash, snack,
    notify, toasts, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    markRead, markAllRead, clearNotifs, unread, sysPerm, enableSystemNotifs,
    keyInfo, keyBusy, saveApiKey, removeApiKey, testApiKey, hasKey,
    canInstall: !!installEv, install, installed, online,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
