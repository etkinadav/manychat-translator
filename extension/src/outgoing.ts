/**
 * Outgoing composer translation — English → Hebrew.
 *
 * Injects a "Translate to Hebrew" button next to the Manychat reply
 * textarea. On click, sends the draft to the backend (targetLanguage: "he")
 * and writes the result back into the textarea with React-friendly events.
 *
 * Separate from incoming message translation (Hebrew → English).
 */

const LOG_PREFIX = "[ManychatTranslator:outgoing]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

const TEXTAREA_SELECTOR =
  'textarea[name="whatsappMessageInput"][data-mc-editor="true"]';
const BUTTON_ATTR = "data-mc-translate-to-hebrew";
const BUTTON_CLASS = "mc-translate-to-hebrew-btn";

const LABEL_DEFAULT = "Translate to Hebrew";
const LABEL_LOADING = "Translating...";
const LABEL_SUCCESS = "Translated ✓";
const LABEL_ERROR = "Translation failed";

const OUTGOING_RESCAN_DEBOUNCE_MS = 150;
const POST_NAVIGATION_DELAYS_MS = [200, 600, 1500];
const REQUEST_TIMEOUT_MS = 15000;
const ERROR_RESET_MS = 2000;
const SUCCESS_RESET_MS = 2000;

interface CsTranslateReply {
  ok: boolean;
  translations?: string[];
  error?: string;
}

let rescanTimer: number | null = null;
let outgoingObserver: MutationObserver | null = null;

function findComposerTextarea(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR);
}

function findButtonForTextarea(textarea: HTMLTextAreaElement): HTMLElement | null {
  const next = textarea.nextElementSibling;
  if (
    next instanceof HTMLElement &&
    next.hasAttribute(BUTTON_ATTR)
  ) {
    return next;
  }
  return document.querySelector<HTMLElement>(`[${BUTTON_ATTR}="true"]`);
}

function createTranslateButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.textContent = LABEL_DEFAULT;
  return btn;
}

function setButtonState(
  btn: HTMLButtonElement,
  state: "default" | "loading" | "success" | "error",
): void {
  btn.classList.remove("loading", "success", "error");
  btn.disabled = state === "loading";

  switch (state) {
    case "loading":
      btn.classList.add("loading");
      btn.textContent = LABEL_LOADING;
      break;
    case "success":
      btn.classList.add("success");
      btn.textContent = LABEL_SUCCESS;
      break;
    case "error":
      btn.classList.add("error");
      btn.textContent = LABEL_ERROR;
      break;
    default:
      btn.textContent = LABEL_DEFAULT;
  }
}

function scheduleButtonReset(
  btn: HTMLButtonElement,
  state: "default" | "error",
  delayMs: number,
): void {
  window.setTimeout(() => setButtonState(btn, state), delayMs);
}

function notifyTextareaChanged(textarea: HTMLTextAreaElement): void {
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function focusTextareaEnd(textarea: HTMLTextAreaElement): void {
  textarea.focus();
  const len = textarea.value.length;
  textarea.setSelectionRange(len, len);
}

function postTranslateOutgoing(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("backend request timed out")),
      REQUEST_TIMEOUT_MS,
    );
    chrome.runtime.sendMessage(
      { type: "translate", texts: [text], targetLanguage: "he" },
      (response: CsTranslateReply | undefined) => {
        window.clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok || !response.translations?.[0]) {
          reject(new Error(response?.error ?? "backend request failed"));
          return;
        }
        resolve(response.translations[0]);
      },
    );
  });
}

async function onTranslateClick(
  btn: HTMLButtonElement,
  textarea: HTMLTextAreaElement,
): Promise<void> {
  const original = textarea.value.trim();
  if (!original) return;

  log("outgoing translation started");
  setButtonState(btn, "loading");

  try {
    const translated = (await postTranslateOutgoing(original)).trim();
    if (!translated) {
      warn("outgoing translation returned empty — keeping original");
      setButtonState(btn, "error");
      scheduleButtonReset(btn, "default", ERROR_RESET_MS);
      return;
    }

    textarea.value = translated;
    notifyTextareaChanged(textarea);
    focusTextareaEnd(textarea);

    log("outgoing translation completed");
    log("textarea updated");
    setButtonState(btn, "success");
    scheduleButtonReset(btn, "default", SUCCESS_RESET_MS);
  } catch (err) {
    warn("outgoing translation failed:", err);
    setButtonState(btn, "error");
    scheduleButtonReset(btn, "default", ERROR_RESET_MS);
  }
}

function tryInjectComposerButton(): boolean {
  const textarea = findComposerTextarea();
  if (!textarea) return false;

  let btn = findButtonForTextarea(textarea);
  if (btn instanceof HTMLButtonElement) {
    return false;
  }

  log("textarea detected");
  btn = createTranslateButton();
  btn.addEventListener("click", () => {
    void onTranslateClick(btn as HTMLButtonElement, textarea);
  });
  textarea.insertAdjacentElement("afterend", btn);
  log("translate button injected");
  return true;
}

function isRelevantOutgoingMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (target?.matches?.(BUTTON_CLASS) || target?.closest?.(`.${BUTTON_CLASS}`)) {
    return false;
  }
  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(BUTTON_CLASS) || node.querySelector?.(BUTTON_CLASS)) {
        continue;
      }
      if (
        node.matches?.(TEXTAREA_SELECTOR) ||
        node.querySelector?.(TEXTAREA_SELECTOR)
      ) {
        return true;
      }
      return true;
    }
    return false;
  }
  return false;
}

function scheduleOutgoingRescan(reason: string): void {
  if (rescanTimer !== null) window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    rescanTimer = null;
    if (tryInjectComposerButton()) {
      log(`composer button injected (${reason})`);
    }
  }, OUTGOING_RESCAN_DEBOUNCE_MS);
}

function startOutgoingObserver(): void {
  if (outgoingObserver) return;
  outgoingObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (isRelevantOutgoingMutation(m)) {
        scheduleOutgoingRescan("mutation");
        return;
      }
    }
  });
  outgoingObserver.observe(document.body, { childList: true, subtree: true });
}

/** Call once from content script boot. */
export function initOutgoing(): void {
  tryInjectComposerButton();
  startOutgoingObserver();
  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => tryInjectComposerButton(), delay);
  }
}

/** Call when SPA conversation URL changes (from content script). */
export function rescanOutgoingComposer(): void {
  tryInjectComposerButton();
  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => tryInjectComposerButton(), delay);
  }
}
