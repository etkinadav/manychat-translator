/**
 * Manychat Translator — content script (MV3)
 *
 * Responsibilities for THIS milestone (no translation yet):
 *   1. Find every visible Manychat message text block on the page.
 *   2. Inject a sibling element directly below each one that *duplicates*
 *      the text. This sibling is where the AI translation will go later.
 *   3. Keep doing this as:
 *        - new messages arrive (MutationObserver),
 *        - the user scrolls older messages into view,
 *        - the user switches conversations (SPA URL change).
 *
 * Design notes:
 *   - Manychat ships CSS-module class names like `_text_10kfu_228`. The
 *     `10kfu` hash will change on every deploy, so we DO NOT hardcode it.
 *     We anchor on the stable attribute `[data-chat-message="block"]` and
 *     find the text element inside it.
 *   - We mark every processed node with `data-ai-processed="true"` AND keep
 *     a WeakSet so we never duplicate the same message twice.
 *   - Rescans are debounced (~150ms) so a burst of mutations triggers one
 *     pass instead of N passes.
 */

const LOG_PREFIX = "[ManychatTranslator]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);

// ---------------------------------------------------------------------------
// Selectors / constants
// ---------------------------------------------------------------------------

/** Stable anchor for a Manychat message bubble. */
const MESSAGE_BLOCK_SELECTOR = '[data-chat-message="block"]';

/**
 * Fallback selectors used INSIDE a message block to find the actual text
 * element. We prefer `data-chat-message="text"` if Manychat exposes it,
 * then fall back to any class that *starts with* `_text_` (CSS-module
 * pattern), and finally to a generic "deepest div with text" heuristic.
 */
const TEXT_NODE_SELECTORS = [
  '[data-chat-message="text"]',
  '[class*="_text_"]',
];

const PROCESSED_ATTR = "data-ai-processed";
const TRANSLATION_ATTR = "data-ai-translated";
const TRANSLATION_CLASS = "mc-ai-translation";

const RESCAN_DEBOUNCE_MS = 150;
const URL_POLL_INTERVAL_MS = 1000;
const POST_NAVIGATION_RESCAN_DELAYS_MS = [200, 600, 1500];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Tracks DOM nodes we have already duplicated, for O(1) re-entry checks. */
const processedTextNodes = new WeakSet<Element>();

let rescanTimer: number | null = null;
let lastUrl = location.href;

// ---------------------------------------------------------------------------
// Core: find + duplicate
// ---------------------------------------------------------------------------

/**
 * Given a Manychat message block, return the inner element that holds the
 * actual text to duplicate, or null if we can't find a meaningful one.
 */
function findTextElementInBlock(block: Element): HTMLElement | null {
  for (const selector of TEXT_NODE_SELECTORS) {
    const candidate = block.querySelector<HTMLElement>(selector);
    if (candidate && hasMeaningfulText(candidate)) {
      return candidate;
    }
  }

  // Heuristic fallback: pick the deepest descendant that contains direct
  // text content. This covers future Manychat refactors where the
  // `_text_` class prefix disappears entirely.
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const el = node as HTMLElement;
      return hasDirectText(el)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });
  const node = walker.nextNode() as HTMLElement | null;
  return node && hasMeaningfulText(node) ? node : null;
}

function hasDirectText(el: Element): boolean {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "") {
      return true;
    }
  }
  return false;
}

function hasMeaningfulText(el: Element): boolean {
  const text = (el.textContent ?? "").trim();
  return text.length > 0;
}

/**
 * Inject (or update) the duplicate block directly under `textEl`.
 * Idempotent: safe to call repeatedly on the same element.
 */
function duplicateMessage(textEl: HTMLElement): boolean {
  if (processedTextNodes.has(textEl)) return false;
  if (textEl.hasAttribute(PROCESSED_ATTR)) {
    processedTextNodes.add(textEl);
    return false;
  }

  const originalText = (textEl.textContent ?? "").replace(/\s+$/g, "");
  if (originalText.trim() === "") return false;

  // If a previous run already inserted a sibling, reuse it. Otherwise create.
  const existing = textEl.nextElementSibling;
  let duplicate: HTMLElement;
  if (
    existing instanceof HTMLElement &&
    existing.classList.contains(TRANSLATION_CLASS)
  ) {
    duplicate = existing;
  } else {
    duplicate = document.createElement("div");
    duplicate.className = TRANSLATION_CLASS;
    duplicate.setAttribute(TRANSLATION_ATTR, "true");
    // Insert directly after the original text element so it appears
    // visually right below the message bubble's text.
    textEl.insertAdjacentElement("afterend", duplicate);
  }

  // For now: duplicate is literally the same text. The future translation
  // step will simply overwrite `duplicate.textContent` with translated text
  // (see `requestTranslation` placeholder at the bottom of this file).
  duplicate.textContent = originalText;

  textEl.setAttribute(PROCESSED_ATTR, "true");
  processedTextNodes.add(textEl);
  return true;
}

/**
 * Full scan: find every message block in the document and duplicate any
 * text node we haven't seen yet. Returns how many new duplicates were
 * injected (purely for logging).
 */
function scanAndDuplicate(root: ParentNode = document): number {
  const blocks = root.querySelectorAll(MESSAGE_BLOCK_SELECTOR);
  if (blocks.length === 0) return 0;

  let injected = 0;
  for (const block of Array.from(blocks)) {
    const textEl = findTextElementInBlock(block);
    if (!textEl) continue;
    if (duplicateMessage(textEl)) injected++;
  }
  if (injected > 0) {
    log(`messages found in scan: ${blocks.length}, newly injected: ${injected}`);
  }
  return injected;
}

// ---------------------------------------------------------------------------
// Debounced rescan
// ---------------------------------------------------------------------------

function scheduleRescan(reason: string): void {
  if (rescanTimer !== null) {
    window.clearTimeout(rescanTimer);
  }
  rescanTimer = window.setTimeout(() => {
    rescanTimer = null;
    const count = scanAndDuplicate();
    if (count > 0) {
      log(`debounced rescan (${reason}) injected ${count} duplicate(s)`);
    }
  }, RESCAN_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// MutationObserver: react to dynamically added messages
// ---------------------------------------------------------------------------

/**
 * Decide whether a given mutation is "interesting enough" to warrant a
 * rescan. We bail out for mutations that only touch our own injected
 * duplicate nodes (otherwise we'd cause an infinite loop).
 */
function isRelevantMutation(mutation: MutationRecord): boolean {
  // Ignore mutations we caused ourselves.
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
  for (const m of mutations) {
    if (isRelevantMutation(m)) relevant++;
  }
  if (relevant === 0) return;
  // For verbose debugging, uncomment the next line:
  // log(`mutation observer: ${relevant} relevant mutation(s)`);
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

/**
 * Manychat is a React SPA: navigating to a different conversation does
 * NOT trigger a full page load, so our content script keeps running but
 * the chat DOM gets re-rendered. We need to:
 *   1. Hook history.pushState / replaceState
 *   2. Listen to popstate
 *   3. Poll location.href as a safety net
 * On every URL change we re-scan a few times with small delays, because
 * React needs a tick or two to actually paint the new messages.
 */
function handleUrlChange(newUrl: string): void {
  log(`page change detected: ${lastUrl} -> ${newUrl}`);
  lastUrl = newUrl;
  for (const delay of POST_NAVIGATION_RESCAN_DELAYS_MS) {
    window.setTimeout(() => {
      const count = scanAndDuplicate();
      log(
        `post-navigation rescan @${delay}ms -> injected ${count} duplicate(s)`,
      );
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
      // Defer to the microtask queue so the URL is fully updated.
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

  // Fallback poller for cases where the SPA mutates the URL without using
  // the History API (rare but cheap to guard against).
  window.setInterval(() => {
    if (location.href !== lastUrl) handleUrlChange(location.href);
  }, URL_POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Future translation hook (placeholder)
// ---------------------------------------------------------------------------

/**
 * FUTURE WORK: replace this no-op with a real translation call.
 *
 * The intended flow will be:
 *   1. `duplicateMessage()` injects an empty `.mc-ai-translation` block
 *      with `data-ai-status="pending"`.
 *   2. Call `requestTranslation(originalText)` -> returns a Promise<string>.
 *   3. When it resolves, set `duplicate.textContent = translatedText` and
 *      remove the `data-ai-status` attribute.
 *
 * The transport (chrome.runtime messaging to a service worker, fetch to an
 * OpenAI/DeepL endpoint, etc.) belongs in a separate `src/translator.ts`
 * module that gets imported here. Keep network calls OUT of the content
 * script directly when possible — proxy them through the service worker
 * so the API key never lives in page context.
 */
// async function requestTranslation(_text: string): Promise<string> {
//   return _text; // TODO
// }

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot(): void {
  log("extension loaded on", location.href);
  // First pass: catch anything already rendered before our script ran.
  scanAndDuplicate();
  startObserver();
  patchHistory();
  // One more scan shortly after boot — Manychat often finishes painting
  // the chat list a few hundred ms after document_idle fires.
  for (const delay of POST_NAVIGATION_RESCAN_DELAYS_MS) {
    window.setTimeout(() => scanAndDuplicate(), delay);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
