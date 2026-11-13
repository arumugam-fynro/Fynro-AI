# Fynro Assistant

Next.js 16 (App Router, React 19, TypeScript) build of the Fynro Assistant UI spec in `Fynro Assistant.md`.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # production + service worker (PWA only registers in production)
npm run icons        # regenerate PWA icons (scripts/make-icons.mjs)
```

## What's in it

- **Chat with Claude** (Anthropic only). Choose Sonnet 5.5, Opus 5.5 or Haiku 5.5. Replies stream in. Attach images, PDFs, CSV and text files and Claude reads them with your message. There is no demo or sample content: a new account starts empty.
- **API key, locked**: Settings › API key. The key is verified with Anthropic, then stored **encrypted** (AES-256-GCM, bound to your user id) in Supabase. It is decrypted only on the server to make a request and is never sent back to the browser, only a masked hint such as `sk-ant-…x7Qd`.
- **In-app notifications**: bell with unread badge + panel, toasts, deep links into chats, optional device notifications and app badge.
- **PWA**: manifest, maskable icons, offline app shell, install button, home-screen shortcut.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in. `KEY_ENCRYPTION_SECRET` = `openssl rand -base64 32`. **Back it up**: if it changes, saved API keys can no longer be decrypted and users must re-enter them.
3. Apply `supabase/migrations/20261113_security_and_api_keys.sql` in the SQL editor of the Supabase project your `SUPABASE_URL` points to. It closes sign-ups (allowlist trigger) and creates the encrypted key table with row-level security.
4. Create users: `npm run create-user -- you@example.com` (adds the email to the allowlist and prints a generated password).
5. `npm run dev`, or `npm run build && npm start`.

### Deploying
Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `KEY_ENCRYPTION_SECRET` on the host. Do **not** set `SUPABASE_SECRET_KEY` there: only the create-user script needs it, and the running app never should. Serve over HTTPS only (HSTS and Secure cookies assume it).

## Security

- **Authentication**: Supabase Auth (email + password), handled entirely server-side. The browser never receives the Supabase URL or keys. Create accounts with `npm run create-user -- you@example.com` (uses `SUPABASE_SECRET_KEY` from `.env`, prints a generated password once).
- **Every route is gated** by `src/proxy.ts`: anonymous page requests redirect to `/login`, `/api/*` returns 401. Tokens are verified against the project's JWKS (ES256), so a forged cookie fails. `/api/chat` re-verifies the session itself.
- **Session cookie** is `httpOnly`, `SameSite=Lax`, `Secure` in production. Logout revokes the refresh token, clears the stored API key, and wipes the service-worker cache.
- **Brute force**: login is limited to 5 tries per IP+email and 20 per IP per 15 min, with one generic error message. `/api/chat` is limited to 40 requests/min per user, with a 512 KB body cap and a same-origin check. The limiter is in-memory: use a shared store (Redis/Upstash) if you run several instances.
- **Headers**: CSP (`connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS, `X-Frame-Options`, COOP/CORP, `nosniff`, a strict Referrer- and Permissions-Policy.
- **Isolation**: local chat data and the API key are namespaced per user id, so accounts sharing a browser can't see each other's data.
- **Secrets**: `.env` is gitignored. `SUPABASE_SECRET_KEY` is only used by the create-user script and must never be exposed to the client.
- **Sign-ups are closed in the database**: a trigger on `auth.users` rejects any email not in `allowed_emails`, so the public Supabase sign-up endpoint cannot create accounts. (Also switching off *Allow new users to sign up* in the dashboard is a good second layer.)
- **API keys at rest**: AES-256-GCM with a server-only secret and the user id as authenticated data, behind row-level security (`user_id = auth.uid()`), so neither a database leak nor a copied row exposes a key.

## Performance notes

No UI/icon/state libraries (inline Lucide paths, React state). Settings and Search are code-split with `next/dynamic`. Memoised rows and messages, rAF-throttled stream updates, debounced persistence, `content-visibility` on long threads, `next/font` self-hosted Geist, and the theme is applied by a pre-paint inline script to avoid flashes.

## Known limits

- Fynro cannot see bank accounts yet. The model is told this and won't invent figures. Connectors (e.g. Account Aggregator) were removed rather than faked.
- Chats live in the browser, per account, and are not synced across devices.
- DOCX/XLSX attachments aren't supported (use PDF, CSV or text).
