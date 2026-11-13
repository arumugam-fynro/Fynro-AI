# Fynro Assistant

Next.js 16 (App Router, React 19, TypeScript) build of the Fynro Assistant UI spec in `Fynro Assistant.md`.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # production + service worker (PWA only registers in production)
npm run icons        # regenerate PWA icons (scripts/make-icons.mjs)
```

## What's in it

- **Chat UI** per the spec: liquid-glass dark/light/system themes, sidebar + icon rail, pinned/recents, search (⌘K), attachments, links, voice dictation with waveform, connectors, settings.
- **API key (bring your own)**: Settings › API key. Choose Anthropic or OpenAI, pick a model, paste a key, Save runs a live check. Keys are stored per provider in this browser's `localStorage` (`fynro-api-key`), never in the chat store or exports. `/api/chat` receives the key in the `x-user-api-key` header, forwards it to the provider and streams text back. It never stores or logs it. With no key, the app uses the original canned demo replies. Set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` on the server to provide a shared fallback.
- **In-app notifications**: bell with unread badge + panel, toasts, mark read / clear, deep-links into chats. Triggers: reply finished while you're in another chat or the tab is hidden, connector connected, money alerts. Optional device notifications via the service worker (Settings › Notifications) when the app is in the background, plus the app-icon badge on installed PWAs.
- **PWA**: `manifest.webmanifest`, maskable icons, `public/sw.js` (shell cached for offline, hashed assets cache-first, `/api/*` never cached), install button in Settings › General, home-screen "New chat" shortcut.

## Performance notes

No UI/icon/state libraries (inline Lucide paths, React state). Settings and Search are code-split with `next/dynamic`. Memoised rows and messages, rAF-throttled stream updates, debounced persistence, `content-visibility` on long threads, `next/font` self-hosted Geist, and the theme is applied by a pre-paint inline script to avoid flashes.

## Known limits

- Connectors (Fynro app, Gmail) only toggle local state. The model is told it cannot query them, so it will not invent account data. Wire real OAuth / Account Aggregator flows to make them live.
- Attachments are sent to the model as names only, not contents.
- A browser-stored key is readable by anyone with that browser profile. For multi-user production, move keys server-side (e.g. encrypted in Supabase) behind auth.
