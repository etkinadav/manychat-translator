# Manychat Translator

A two-part project that detects messages in the Manychat chat UI, sends
them to a local backend, and renders the response inline underneath each
message.

This milestone is still **pre-AI**: the backend simply echoes
`from back: <text>`. The full extension ↔ backend ↔ DOM pipeline is in
place so plugging Google Translate / OpenAI in later is a one-function
change on the backend.

```
manychat-translator/
├── extension/   # MV3 Chrome extension (TypeScript + Vite)
├── frontend/    # Web UI — login + configuration (Angular 16)
└── backend/     # Node + Express + TypeScript API
```

### Backend structure (same pattern as beams)

```
backend/src/
├── app.ts              # Express app — middleware, routes, static frontend
├── server.ts           # Listen + MongoDB connect + graceful shutdown
├── routes/             # Thin routers → controllers
├── controllers/        # Request handlers
├── middleware/         # check-auth, cors, error-handler, async-handler
├── models/             # Mongoose schemas
├── services/           # Google Translate, language pair, etc.
├── db/                 # MongoDB connection
└── types/
```

`routes/user.ts` wires `UserController` + `ProfileController`; `routes/organizations.ts` → `OrganizationController`; `routes/translate.ts` → `TranslateController`.

---

## Run the backend

```bash
cd backend
npm install
cp .env.example .env   # fill MONGO_URI + JWT_KEY (same as beams)
npm run dev            # ts-node-dev, restarts on save
```

You should see:

```
[db] connected to MongoDB
[server] backend started on http://localhost:3000
```

Auth uses the same MongoDB `users` collection and password hashing as **beams**
(`POST /api/user/login` with `{ "username", "password" }` — username or email).

## Run the web frontend

**Option A — same port as backend (recommended, fewer issues):**

```bash
cd frontend
npm install
npm run build
cd ../backend
npm run dev
```

Open **http://localhost:3000/** in a normal Chrome tab (not Cursor’s embedded preview).

**Option B — Angular dev server with hot reload:**

```bash
cd backend
npm run dev          # must be running on :3000

cd frontend
npm start            # http://localhost:5173 — proxies /api to :3000
```

- `/` — login (username + password, **Log in** button).
- `/config` — profile + organization settings.
- `/config/organization` — create or edit an organization (`?edit=<id>`).

### Frontend structure (same pattern as beams)

```
frontend/src/app/
├── app.module.ts
├── app-routing.module.ts
├── auth/              # AuthService, AuthGuard, interceptor
├── services/          # ProfileService, OrganizationsService
├── models/
├── constants/
└── other-pages/
    ├── login/         # login.component.ts | .html | .scss
    ├── config/
    └── organization-form/
```

Global styles: `frontend/src/styles.scss`. Per-page styles in each component’s `.scss`.

### `chrome-error://chromewebdata` / “Unsafe attempt to load localhost:5173”

This usually means one of:

1. **Frontend dev server is not running** — you opened `:5173` but only started `backend` or `extension`. Use option A above, or run `npm run dev` inside `frontend/`.
2. **Opened inside an iframe** (e.g. Cursor Simple Browser) — open the URL in a regular Chrome window instead.

Quick sanity check from another terminal:

```bash
curl -X POST http://localhost:3000/api/translate ^
  -H "Content-Type: application/json" ^
  -d "{\"texts\":[\"שלום\",\"מה נשמע?\"]}"
```

Expected response:

```json
{ "translations": ["from back: שלום", "from back: מה נשמע?"] }
```

## Run the extension

```bash
cd extension
npm install
npm run build        # one-off build  -> extension/dist/
npm run dev          # rebuild on save -> extension/dist/
```

Load it into Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select **`extension/dist/`**.
4. Open `https://app.manychat.com/<account>/chat/<conversation>`.
5. Make sure the backend is running on `http://localhost:3000`.
6. Open DevTools → Console. You'll see `[ManychatTranslator]` logs, a
   small bouncing-dots spinner under each message bubble, and then the
   `from back: …` text fading in with a blue highlight sweep.

When you change extension code, run `npm run build` (or keep
`npm run dev` running), click the **reload** icon on the extension card,
and refresh the Manychat tab.

---

## Architecture overview

### Backend files

| File | Purpose |
| --- | --- |
| `backend/package.json` | Express, cors, ts-node-dev, typescript. Scripts: `dev`, `build`, `start`, `typecheck`. |
| `backend/tsconfig.json` | CommonJS, strict mode, output to `dist/`. |
| `backend/src/server.ts` | Boots Express, configures CORS, mounts the route, error-handler middleware. |
| `backend/src/routes/translate.ts` | The `POST /api/translate` handler. Validates the body and (currently) echoes `from back: <text>`. This is the file you'll edit when adding Google Translate. |
| `backend/src/types/index.ts` | `TranslateRequest` / `TranslateResponse` / `ErrorResponse` wire types. |

### Extension files

| File | Purpose |
| --- | --- |
| `extension/manifest.json` | MV3 manifest. `host_permissions` covers `app.manychat.com` *and* `localhost:3000` so the content script can fetch the backend. |
| `extension/src/content.ts` | All extension logic: detection, queueing, batched fetch, spinner injection, DOM swap, animation, error fallback, MutationObserver, SPA URL handling. |
| `extension/src/styles.css` | Translation block styles, 3-dot spinner, highlight-sweep + pulse animation, error pill. |
| `extension/vite.config.ts` | Bundles `src/content.ts` into a single IIFE `dist/content.js` and copies `manifest.json` + `styles.css` into `dist/`. |

---

## How the extension talks to the backend

1. The content script scans the DOM for `[data-chat-message="block"]`
   elements and finds the inner text node inside each.
2. For each new text node it injects a sibling block:

   ```html
   <div class="mc-ai-translation loading" data-ai-translated="true">
     <div class="mc-spinner"><span></span><span></span><span></span></div>
   </div>
   ```

3. The original text is pushed onto `pendingQueue` along with a pointer
   to the placeholder DOM element.
4. A short debounce (80 ms) batches every text that arrived in that
   window into one `fetch` call:

   ```
   POST http://localhost:3000/api/translate
   Content-Type: application/json
   { "texts": ["שלום", "מה נשמע?"] }
   ```

5. The backend responds with the same-length array. The content script
   walks the batch and applies each translation back to its placeholder
   by index.
6. CORS is handled by the backend: requests from
   `chrome-extension://<id>` and `http://localhost*` are allowed.
7. The `fetch` is wrapped in an 8-second `AbortController` timeout. If
   it times out or the backend returns a non-2xx, every placeholder in
   the failed batch gets the error class and the text
   `"translation failed"`.

## How the spinner works

- Three `<span>` dots inside a flex container (`.mc-spinner`).
- Each dot animates `transform: translateY` and `opacity` via
  `@keyframes mc-spinner-bounce`, staggered by `animation-delay`
  (0 / 150 ms / 300 ms) so they look like a wave.
- The dots use `background: currentColor`, so the spinner inherits the
  surrounding text color and stays visible on both light and dark themes.
- The whole `.loading` state has a fixed `min-height` of 18 px so the
  layout doesn't jump when the spinner is later replaced with real text.

## How the update animation works

When the response arrives, `applyTranslation()`:

1. Removes `.loading`, writes the new text content.
2. Reads `placeholder.offsetWidth` to force a reflow — this guarantees
   the animation restarts even if the element had `.updated` before.
3. Adds `.updated`, which triggers **two** simultaneous one-shot
   keyframe animations defined in `styles.css`:

   - `mc-pulse` (0.9 s): background color flashes blue and fades back to
     the resting yellow, with a soft `box-shadow` ring expanding and
     dissipating.
   - `mc-sweep` (0.9 s): a `::after` pseudo-element with a horizontal
     gradient slides from `translateX(-100%)` to `translateX(100%)`,
     creating a quick highlight wipe across the bubble.

Together they give an unambiguous "the DOM just updated" signal.

## MutationObserver and SPA URL handling

Same model as before:

- One observer on `document.body` (`childList + subtree + characterData`),
  filtering out mutations whose target is one of our own injected nodes
  so we can't feedback-loop.
- A 150 ms debounce coalesces bursts of mutations into a single rescan.
- `history.pushState` / `history.replaceState` are wrapped, plus a
  `popstate` listener and a 1-second `setInterval` fallback, so every
  flavour of Manychat SPA navigation triggers `handleUrlChange()`.
- On URL change we rescan at 200 ms / 600 ms / 1500 ms because React
  often paints the new conversation a few frames later.

## Where Google Translate plugs in

`backend/src/routes/translate.ts`:

```ts
const translations = texts.map((t) => `from back: ${t}`);
```

Replace that single line with a call to Google Translate (or any other
translation API). The whole extension stays untouched — same request
body, same response shape, same spinner-then-animate UX.

A typical evolution:

```ts
import { TranslationServiceClient } from "@google-cloud/translate";
const client = new TranslationServiceClient();

const [resp] = await client.translateText({
  parent: `projects/${process.env.GCP_PROJECT_ID}/locations/global`,
  contents: texts,
  mimeType: "text/plain",
  sourceLanguageCode: body.sourceLang,   // already in the wire type
  targetLanguageCode: body.targetLang ?? "en",
});
const translations = resp.translations?.map((t) => t.translatedText ?? "") ?? [];
```

The API key never leaves the backend — the extension only talks to
`http://localhost:3000`, which is exactly what we want from a security
standpoint.
