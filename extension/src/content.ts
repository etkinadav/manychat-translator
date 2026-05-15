/**
 * Manychat Translator — content script (MV3)
 *
 * Pipeline (this milestone, no real translation yet):
 *   1. Detect Manychat message bubbles via the stable
 *      [data-chat-message="block"] anchor.
 *   2. For each new message: inject a sibling translation block in
 *      LOADING state (showing a CSS spinner).
 *   3. Queue the original text. A short debounce later we POST the whole
 *      batch to http://localhost:3000/api/translate.
 *   4. Map each response string back to its DOM placeholder, swap in the
 *      text, play a brief highlight animation, mark UPDATED.
 *   5. If the backend errors, swap the spinner for "translation failed"
 *      without crashing the extension.
 *
 * Re-entry safety:
 *   - WeakSet of processed text nodes
 *   - `data-ai-processed="true"` attribute on the original text element
 *   - MutationObserver explicitly ignores our injected nodes
 */

const LOG_PREFIX = "[ManychatTranslator]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

// ---------------------------------------------------------------------------
// Selectors / constants
// ---------------------------------------------------------------------------

const MESSAGE_BLOCK_SELECTOR = '[data-chat-message="block"]';

const TEXT_NODE_SELECTORS = [
  '[data-chat-message="text"]',
  '[class*="_text_"]',
];

const PROCESSED_ATTR = "data-ai-processed";
const TRANSLATION_ATTR = "data-ai-translated";
const TRANSLATION_CLASS = "mc-ai-translation";

const BACKEND_URL = "http://localhost:3000/api/translate";

const RESCAN_DEBOUNCE_MS = 150;
const QUEUE_FLUSH_DEBOUNCE_MS = 80;
const REQUEST_TIMEOUT_MS = 8000;
const URL_POLL_INTERVAL_MS = 1000;
const POST_NAVIGATION_RESCAN_DELAYS_MS = [200, 600, 1500];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const processedTextNodes = new WeakSet<Element>();

interface PendingItem {
  text: string;
  placeholder: HTMLElement;
}
const pendingQueue: PendingItem[] = [];

let rescanTimer: number | null = null;
let flushTimer: number | null = null;
let lastUrl = location.href;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function findTextElementInBlock(block: Element): HTMLElement | null {
  for (const selector of TEXT_NODE_SELECTORS) {
    const candidate = block.querySelector<HTMLElement>(selector);
    if (candidate && hasMeaningfulText(candidate)) return candidate;
  }
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      hasDirectText(node as HTMLElement)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });
  const node = walker.nextNode() as HTMLElement | null;
  return node && hasMeaningfulText(node) ? node : null;
}

function hasDirectText(el: Element): boolean {
  for (const child of Array.from(el.childNodes)) {
    if (
      child.nodeType === Node.TEXT_NODE &&
      (child.textContent ?? "").trim() !== ""
    ) {
      return true;
    }
  }
  return false;
}

function hasMeaningfulText(el: Element): boolean {
  return (el.textContent ?? "").trim().length > 0;
}

// ---------------------------------------------------------------------------
// Placeholder injection
// ---------------------------------------------------------------------------

/**
 * Insert a loading placeholder under `textEl` and queue the text for
 * backend translation. Idempotent — already-processed nodes are skipped.
 *
 * Returns true if a NEW placeholder was queued, false otherwise.
 */
function queueForTranslation(textEl: HTMLElement): boolean {
  if (processedTextNodes.has(textEl)) return false;
  if (textEl.hasAttribute(PROCESSED_ATTR)) {
    processedTextNodes.add(textEl);
    return false;
  }

  const originalText = (textEl.textContent ?? "").replace(/\s+$/g, "");
  if (originalText.trim() === "") return false;

  // Reuse existing sibling if any (e.g. after a hot reload).
  let placeholder: HTMLElement;
  const existing = textEl.nextElementSibling;
  if (
    existing instanceof HTMLElement &&
    existing.classList.contains(TRANSLATION_CLASS)
  ) {
    placeholder = existing;
    placeholder.classList.remove("updated", "error");
  } else {
    placeholder = document.createElement("div");
    placeholder.className = `${TRANSLATION_CLASS} loading`;
    placeholder.setAttribute(TRANSLATION_ATTR, "true");
    textEl.insertAdjacentElement("afterend", placeholder);
  }

  placeholder.classList.add("loading");
  placeholder.innerHTML = "";
  const spinner = document.createElement("div");
  spinner.className = "mc-spinner";
  spinner.setAttribute("aria-label", "Loading translation");
  spinner.append(
    document.createElement("span"),
    document.createElement("span"),
    document.createElement("span"),
  );
  placeholder.appendChild(spinner);

  textEl.setAttribute(PROCESSED_ATTR, "true");
  processedTextNodes.add(textEl);

  pendingQueue.push({ text: originalText, placeholder });
  log(`message queued (queue size=${pendingQueue.length})`);
  scheduleFlush();
  return true;
}

function scanAndQueue(root: ParentNode = document): number {
  const blocks = root.querySelectorAll(MESSAGE_BLOCK_SELECTOR);
  if (blocks.length === 0) return 0;

  let queued = 0;
  for (const block of Array.from(blocks)) {
    const textEl = findTextElementInBlock(block);
    if (!textEl) continue;
    if (queueForTranslation(textEl)) queued++;
  }
  if (queued > 0) {
    log(`scan: ${blocks.length} blocks, ${queued} newly queued`);
  }
  return queued;
}

// ---------------------------------------------------------------------------
// Backend client
// ---------------------------------------------------------------------------

interface TranslateResponse {
  translations: string[];
}

async function postTranslate(texts: string[]): Promise<string[]> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`backend returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as TranslateResponse;
    if (!Array.isArray(data.translations)) {
      throw new Error("backend response missing `translations` array");
    }
    if (data.translations.length !== texts.length) {
      throw new Error(
        `backend returned ${data.translations.length} translations for ${texts.length} texts`,
      );
    }
    return data.translations;
  } finally {
    window.clearTimeout(timeout);
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, QUEUE_FLUSH_DEBOUNCE_MS);
}

async function flushQueue(): Promise<void> {
  if (pendingQueue.length === 0) return;
  const batch = pendingQueue.splice(0, pendingQueue.length);
  const texts = batch.map((b) => b.text);

  log(`backend request started | size=${batch.length}`);
  try {
    const translations = await postTranslate(texts);
    log(`backend response received | size=${translations.length}`);
    batch.forEach((item, i) => applyTranslation(item.placeholder, translations[i]!));
    log(`DOM updated for ${batch.length} message(s)`);
  } catch (err) {
    warn("backend request failed:", err);
    batch.forEach((item) => applyError(item.placeholder));
  }
}

// ---------------------------------------------------------------------------
// DOM update
// ---------------------------------------------------------------------------

function applyTranslation(placeholder: HTMLElement, text: string): void {
  placeholder.classList.remove("loading", "error");
  placeholder.textContent = text;
  // Force a reflow before adding `updated` so the CSS animation always
  // restarts (even if the class was already present on a previous cycle).
  void placeholder.offsetWidth;
  placeholder.classList.add("updated");
}

function applyError(placeholder: HTMLElement): void {
  placeholder.classList.remove("loading", "updated");
  placeholder.classList.add("error");
  placeholder.textContent = "translation failed";
}

// ---------------------------------------------------------------------------
// Debounced rescan
// ---------------------------------------------------------------------------

function scheduleRescan(reason: string): void {
  if (rescanTimer !== null) window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    rescanTimer = null;
    const count = scanAndQueue();
    if (count > 0) log(`debounced rescan (${reason}) queued ${count}`);
  }, RESCAN_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// MutationObserver
// ---------------------------------------------------------------------------

function isRelevantMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (target?.classList?.contains(TRANSLATION_CLASS)) return false;
  if (target?.closest?.(`.${TRANSLATION_CLASS}`)) return false;

  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof Element)) continue;
      if (node.classList.contains(TRANSLATION_CLASS)) continue;
      return true;
    }
    return false;
  }
  return true;
}

const observer = new MutationObserver((mutations) => {
  let relevant = 0;
  for (const m of mutations) if (isRelevantMutation(m)) relevant++;
  if (relevant === 0) return;
  scheduleRescan("mutation");
});

function startObserver(): void {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  log("MutationObserver attached to <body>");
}

// ---------------------------------------------------------------------------
// SPA URL change detection
// ---------------------------------------------------------------------------

function handleUrlChange(newUrl: string): void {
  log(`URL change detected: ${lastUrl} -> ${newUrl}`);
  lastUrl = newUrl;
  for (const delay of POST_NAVIGATION_RESCAN_DELAYS_MS) {
    window.setTimeout(() => {
      const count = scanAndQueue();
      log(`post-navigation rescan @${delay}ms -> queued ${count}`);
    }, delay);
  }
}

function patchHistory(): void {
  const wrap = (method: "pushState" | "replaceState") => {
    const original = history[method].bind(history) as (
      ...a: unknown[]
    ) => unknown;
    history[method] = function patched(...args: unknown[]): unknown {
      const result = original(...args);
      queueMicrotask(() => {
        if (location.href !== lastUrl) handleUrlChange(location.href);
      });
      return result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  };
  wrap("pushState");
  wrap("replaceState");

  window.addEventListener("popstate", () => {
    if (location.href !== lastUrl) handleUrlChange(location.href);
  });

  window.setInterval(() => {
    if (location.href !== lastUrl) handleUrlChange(location.href);
  }, URL_POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  log("extension loaded on", location.href);
  scanAndQueue();
  startObserver();
  patchHistory();
  for (const delay of POST_NAVIGATION_RESCAN_DELAYS_MS) {
    window.setTimeout(() => scanAndQueue(), delay);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
