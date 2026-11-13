/* Fynro service worker: app-shell caching + notification clicks. */
const VERSION = 'fynro-v3';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (e) => {
  // No pre-caching of '/': it is per-user and requires a session. It is cached after a real signed-in visit.
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // never cache API/key traffic

  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Only keep a genuine signed-in home page; never the login redirect or error pages.
          if (url.pathname === '/' && res.ok && !res.redirected) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put('/', copy)); }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Hashed build assets, fonts and icons: cache first, revalidate in the background.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});

// Sent on logout: forget every cached page so the next person on this device sees nothing.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'clear-cache') e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith(VERSION)).map((n) => caches.delete(n)))));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const chatId = e.notification.data && e.notification.data.chatId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list[0];
      if (c) { c.focus(); if (chatId) c.postMessage({ type: 'open-chat', chatId }); return; }
      return self.clients.openWindow('/');
    })
  );
});
