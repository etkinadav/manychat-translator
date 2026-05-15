# Manychat Translator (scaffold)

A **Chrome Manifest V3** extension that runs on `https://app.manychat.com/*`,
finds every chat-message bubble, and **injects a duplicate of the message
text directly underneath it**.

This first milestone is intentionally **not** translating yet — the duplicate
is identical to the original. It exists as the future home for an AI
translation layer (see `src/content.ts` → "Future translation hook").

---

## Project layout

```
manychat-translator/
├── manifest.json          # MV3 manifest, points at content.js + styles.css
├── package.json           # Vite + TypeScript dev deps and scripts
├── tsconfig.json          # Strict TS config, DOM + chrome types
├── vite.config.ts         # Bundles content script + copies static assets
├── src/
│   ├── content.ts         # The whole extension lives here
│   └── styles.css         # Styling for the injected duplicate block
└── dist/                  # Build output (load this into Chrome)
```

## Run locally

```bash
npm install
npm run build      # one-off production build  -> dist/
npm run dev        # rebuilds on every save    -> dist/
```

`npm run build` produces three files in `dist/`:

- `dist/manifest.json`
- `dist/content.js` (bundled, IIFE — no ESM imports, Chrome-safe)
- `dist/styles.css`

## Load the extension into Chrome

1. Build the project (`npm run build`) so the `dist/` folder exists.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the **`dist/`** folder.
5. Open `https://app.manychat.com/<account_id>/chat/<conversation_id>` — for example
   `https://app.manychat.com/fb4318480/chat/1610950219`.
6. Open DevTools → Console. You should see logs prefixed with
   `[ManychatTranslator]` and a light-yellow duplicate line underneath
   every message bubble.

When you change the code, run `npm run build` (or leave `npm run dev`
running), then click the **reload** icon on the extension card in
`chrome://extensions`, and refresh the Manychat tab.

---

## How it works

### 1. Message detection

Manychat ships its CSS as CSS Modules, so class names look like
`_text_10kfu_228`. The `10kfu` part is a build-hash that **changes on
every deploy**, so we deliberately do not hardcode it.

Instead the content script anchors on a stable attribute:

```ts
const MESSAGE_BLOCK_SELECTOR = '[data-chat-message="block"]';
```

For each block we look for the inner text element using a layered
fallback (`data-chat-message="text"` → any `[class*="_text_"]` →
deepest descendant with direct text). This way the extension keeps
working even if Manychat reshuffles its DOM.

### 2. Duplicate injection

For every text element found we insert a sibling **immediately after** it:

```html
<div class="mc-ai-translation" data-ai-translated="true">…same text…</div>
```

The original text element gets `data-ai-processed="true"` and is also
tracked in a `WeakSet`, so it is never duplicated twice — even if the
MutationObserver fires repeatedly.

The injected block is styled (see `src/styles.css`) with:

- light-yellow background (`rgba(255,255,0,0.15)`)
- 4–6 px padding, 6 px border-radius, 4 px margin-top
- 0.9em font-size
- `white-space: pre-wrap` to preserve newlines
- `unicode-bidi: plaintext` so Hebrew text renders RTL automatically

### 3. MutationObserver (live updates)

A single `MutationObserver` is attached to `document.body` with
`{ childList: true, subtree: true, characterData: true }`. Whenever
Manychat adds new message nodes (new incoming message, infinite scroll
loading older messages, switching conversations, etc.) the observer
fires, we **filter out our own injected nodes** to avoid an infinite
loop, then schedule a **debounced** rescan (~150 ms) that walks all
message blocks and processes only the new ones.

### 4. SPA URL change detection

Manychat is a React single-page app — moving between conversations
**does not** trigger a full page load. The content script handles this
by combining four mechanisms:

1. Monkey-patching `history.pushState` and `history.replaceState`.
2. A `popstate` listener (browser back/forward).
3. A 1-second `setInterval` fallback that compares `location.href` to a
   cached value — covers exotic SPA navigations that bypass the History API.
4. When a change is detected, we run **three** rescans at 200 ms / 600 ms /
   1500 ms so we don't miss messages that React paints a few frames later.

### 5. Performance

- All re-entry is guarded by `WeakSet` + `data-ai-processed` attribute.
- Rescans are debounced — bursts of mutations collapse to a single pass.
- The observer ignores mutations whose target is one of our own
  injected `.mc-ai-translation` nodes, eliminating feedback loops.
- We never walk the whole DOM blindly: `scanAndDuplicate()` queries
  `[data-chat-message="block"]` directly, which Manychat keeps small.

---

## Where the future translation logic will go

Open `src/content.ts` and look for the **"Future translation hook"**
section near the bottom. The intended evolution is:

1. In `duplicateMessage()`, instead of writing the original text into the
   duplicate, write an empty placeholder and set
   `data-ai-status="pending"` (styled in `styles.css`).
2. Call `requestTranslation(originalText)` which lives in a new
   `src/translator.ts` module.
3. That module will `chrome.runtime.sendMessage(...)` to a background
   **service worker** (added later to `manifest.json` under
   `"background": { "service_worker": "background.js" }`) which makes
   the actual network call to OpenAI / DeepL / etc. Keeping the API key
   in the service worker — not in the page context — is the secure path.
4. When the promise resolves, set `duplicate.textContent = translated`
   and remove the `data-ai-status` attribute.

No other piece of the architecture (detection, observer, URL handling,
styling) needs to change to enable translation.
