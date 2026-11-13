'use client';

import { useEffect } from 'react';
import { useApp } from './AppProvider';

export function PwaRegister() {
  const a = useApp();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    const reg = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
  }, []);

  // Home-screen shortcut: /?new=1 opens a blank chat.
  useEffect(() => {
    if (!a.hydrated) return;
    const u = new URL(location.href);
    if (u.searchParams.has('new')) { a.newChat(); history.replaceState(null, '', '/'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.hydrated]);

  return null;
}
