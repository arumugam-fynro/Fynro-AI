# Fynro Assistant — UI Spec

Source: `Fynro Assistant v2.dc.html` · Standalone build: `Fynro Assistant.html`

An AI finance assistant chat interface with a black liquid-glass look, light/dark themes, connectors, attachments and voice input. Fully responsive (mobile < 768px, laptop ≥ 768px).

---

## 1. Visual system

### Typography
- **Body / UI:** Geist 400 / 500 / 600
- **Mono (shortcuts, timer):** Geist Mono 400
- Hero headline 40px (30px mobile), letter-spacing −0.03em
- Body 15–16px, UI labels 13–14.5px, section labels 11.5px uppercase +0.06em

### Color tokens (set on the root wrapper as CSS variables)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#050506` | `#e7e7ea` | App ground |
| `--frame` | `rgba(10,10,11,.55)` | `rgba(255,255,255,.35)` | App surface |
| `--panel` | `rgba(24,24,26,.62)` | `rgba(255,255,255,.55)` | Sidebar glass |
| `--glass` | `rgba(255,255,255,.045)` | `rgba(255,255,255,.5)` | Cards, composer tray |
| `--glass-2` | `rgba(255,255,255,.075)` | `rgba(0,0,0,.045)` | Hover, chips, pills |
| `--sel` | `rgba(255,255,255,.09)` | `rgba(0,0,0,.06)` | Selected row / tab |
| `--line` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` | Hairlines |
| `--line-2` | `rgba(255,255,255,.15)` | `rgba(0,0,0,.14)` | Strong borders |
| `--text` | `#f4f4f5` | `#111113` | Primary text |
| `--muted` | `rgba(244,244,245,.56)` | `rgba(17,17,19,.55)` | Secondary text |
| `--inset` | `rgba(0,0,0,.42)` | `rgba(255,255,255,.72)` | Inputs, composer well |
| `--pop` | `rgba(26,26,29,.8)` | `rgba(255,255,255,.82)` | Menus, modals |
| `--btn-bg` / `--btn-fg` | `#f4f4f5` / `#0a0a0b` | `#111113` / `#fff` | Primary button |

Accents (functional only): toggle on `#3b82f6`, check `#7aa7ff`, recording `#ef4444`, connected dot `#4ade80`, destructive `#f87171`.

### Glass recipe
```
background: var(--glass | --panel | --pop);
backdrop-filter: blur(40px) saturate(160%);
border: 1px solid var(--line | --line-2);
box-shadow: 0 20–30px 60–80px rgba(0,0,0,.35–.5), inset 0 1px 0 rgba(255,255,255,.06–.08);
```
Main area has a fractal-noise grain overlay (`mix-blend-mode: overlay`, opacity 0.22 dark / 0.12 light).

### Radii
Menu items 9–10px · inputs 12px · cards 16px · menus 18px · composer tray 24px / well 19px · modals 20–22px · pills & round buttons 999px.

### Icons
Lucide, stroke 1.6, round caps/joins, 14–20px.

---

## 2. Layout

```
┌──────────── Sidebar 284px ───────────┬──────────── Main ────────────────┐
│ [F] Fynro                    [panel] │ [icon] Chat title ▾      [theme] │
│ [🔍 Search                    ⌘ K]   │                                  │
│ ─────────────────────────────────    │        Hi, Arjun                 │
│ + New chat                           │  What should we look at today?   │
│ ⏚ Connectors                   [n]   │  ┌─ composer tray ────────────┐  │
│ PINNED                               │  │ textarea                   │  │
│   📌 chat …                          │  │ [+] [sources]      [🎤] [↑] │  │
│ RECENTS                              │  └────────────────────────────┘  │
│   chat …                             │   disclaimer                     │
│ ─────────────────────────────────    │                                  │
│ (A) Arjun · Pro plan            ⇅    │                                  │
└──────────────────────────────────────┴──────────────────────────────────┘
```
- Empty state: greeting + composer vertically centred, text centre-aligned, max-width 780px.
- With messages: scrolling thread on top, composer pinned to bottom.
- Collapsed sidebar → 64px icon rail (desktop only).

---

## 3. Features

### Sidebar
- **New chat** — clears active chat, shows empty state.
- **Search** (button or ⌘/Ctrl K) — modal that filters by title and message text, shows snippet.
- **Connectors** — opens Settings › Connectors; badge shows connected count.
- **Pinned / Recents** — sorted by last update. Active row uses `--sel`.
- **Row "…" menu** — Pin/Unpin, Rename (inline input; Enter saves, Esc cancels), Delete (confirm dialog).
- **Account menu** — Settings, Light/Dark theme, Log out.

### Header
- Chat title with ▾ opens the same Pin / Rename / Delete menu.
- Theme toggle (sun / moon).
- Mobile: hamburger (opens drawer) and new-chat button.

### Composer
- Auto-growing textarea (`field-sizing: content`, max 220px). Enter sends, Shift+Enter newline.
- Drag-and-drop files onto the composer.
- Attachment chips above the text: image thumbnail / document / link tile, name, size or type, remove ×.
- Bottom row: **+** menu · Research pill (when on) · sources pill · **mic** · **send** (disabled at 35% when empty).

### + menu
| Item | Behaviour |
|---|---|
| Upload or add files `⌘ U` | File picker: images, PDF, DOC/DOCX, XLS/XLSX, CSV, TXT |
| Take a photo | Mobile only — camera capture |
| Add a link | Inline URL field + Add; validates hostname |
| Connectors › | Sub-view with per-chat toggles, back arrow, Manage connectors |
| Research | Toggle (✓). Adds "the web" to sources |
| Memory | Toggle (✓) |

Opens below the + button when there is ≥380px of space, otherwise above. Width `min(320px, viewport − 16px)`.

### Voice to text
- Mic → recording row: cancel ×, pulsing red dot, `m:ss` timer, live waveform (40 bars desktop / 22 mobile, heights from mic RMS), Done ✓.
- Live transcription via Web Speech API (`en-IN`, interim results) streams into the textarea. Placeholder becomes "Listening…".
- Fallback when mic or speech isn't available: simulated levels and a sample sentence typed in.
- Esc or × discards the dictated text; ✓ or Send keeps it.

### Messages
- User: right-aligned glass bubble (20/20/6/20 radius) with any attachments above it.
- Assistant: plain text, optional "Checked {sources}" pill, glass table, follow-up note, Copy and Retry (last message).
- Pending: pulsing "Reading {sources}…" / "Thinking…".

### Settings (modal)
- **General** — display name, response style (Concise / Balanced / Detailed), financial year (Apr–Mar / Jan–Dec).
- **Appearance** — Light / Dark / System segmented control plus preview cards.
- **Connectors** — search field; rows with logo, name, description, green dot when connected, Connect / Disconnect.
- **Data & privacy** — Export chats (JSON), Disconnect all, Delete all chats (confirm).

### Connectors (current)
| Id | Name | Logo | Default |
|---|---|---|---|
| `fynro` | Fynro app | White "F" tile | Connected, active |
| `gmail` | Gmail | Gmail mark on white tile | Not connected |

---

## 4. Responsive behaviour (< 768px)
- Sidebar becomes an off-canvas drawer (max 86vw) with a blurred backdrop; closes on chat select or new chat.
- Header: hamburger + new chat + theme.
- Horizontal padding 24 → 12px; hero 40 → 30px.
- Settings goes full-screen; tabs become a horizontally scrolling row; "Settings" title hidden.
- `100dvh` height; 16px textarea to avoid iOS zoom.

## 5. Layering (z-index)
Mobile drawer backdrop 48 · drawer 49 · menu-close layer 47 · menus 52 · search/settings 60 · confirm 70 · toast 80.

## 6. Keyboard
| Keys | Action |
|---|---|
| ⌘/Ctrl K | Search |
| ⌘/Ctrl U | Upload files |
| Enter / Shift+Enter | Send / newline |
| Esc | Close menus and modals, cancel recording, cancel rename |

## 7. State & persistence
`localStorage["fynro-assistant-v2"]` stores chats, connectors, theme, name, response style, financial year and active chat. Attachments of images under 1.5MB keep a data-URL thumbnail.

## 8. Tweakable props
| Prop | Type | Default |
|---|---|---|
| `startTheme` | `dark` \| `light` \| `system` | `dark` |
| `userName` | string | `Arjun` |
| `showDisclaimer` | boolean | `true` |

## 9. Notes for production
- Assistant replies are canned keyword matches (`makeReply`). Replace them with your model API.
- Connector connect/disconnect only changes local state. Wire it to OAuth / Account Aggregator flows.
- Copy uses `navigator.clipboard`; export downloads `fynro-chats.json`.
