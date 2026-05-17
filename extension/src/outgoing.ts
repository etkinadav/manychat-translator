/**
 * Outgoing composer translation — user language → organization language.
 */

import { translateToButtonLabel } from "./constants/languages";
import { fetchSession } from "./session-client";
import type { ExtensionSession } from "./types";

const LOG_PREFIX = "[ManychatTranslator:outgoing]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

const TEXTAREA_SELECTOR =
  'textarea[name="whatsappMessageInput"][data-mc-editor="true"]';
const TOOLBAR_ATTR = "data-mc-outgoing-toolbar";
const BUTTON_ATTR = "data-mc-translate-outgoing";
const BUTTON_CLASS = "mc-translate-to-hebrew-btn";

const LABEL_LOADING = "Translating...";
const LABEL_SUCCESS = "Translated ✓";
const LABEL_ERROR = "Translation failed";
const LABEL_DRY_RUN = "Dry run — see console";
const LABEL_SIGN_IN = "Sign in (extension popup)";

const OUTGOING_RESCAN_DEBOUNCE_MS = 150;
const POST_NAVIGATION_DELAYS_MS = [200, 600, 1500];
const REQUEST_TIMEOUT_MS = 15000;
const ERROR_RESET_MS = 2000;
const SUCCESS_RESET_MS = 2000;

let cachedSession: ExtensionSession | null = null;
let defaultButtonLabel = LABEL_SIGN_IN;

interface CsTranslateReply {
  ok: boolean;
  translations?: string[];
  error?: string;
  dryRun?: boolean;
  dryRunNote?: string;
  geminiPrompt?: string;
}

let rescanTimer: number | null = null;
let outgoingObserver: MutationObserver | null = null;

async function ensureSession(): Promise<ExtensionSession | null> {
  try {
    cachedSession = await fetchSession(false);
    if (cachedSession.organization) {
      defaultButtonLabel = translateToButtonLabel(
        cachedSession.organization.language,
      );
    } else {
      defaultButtonLabel = "Connect organization (web app)";
    }
    return cachedSession;
  } catch {
    cachedSession = null;
    defaultButtonLabel = LABEL_SIGN_IN;
    return null;
  }
}

function findComposerTextarea(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>(TEXTAREA_SELECTOR);
}

function findToolbarForTextarea(textarea: HTMLTextAreaElement): HTMLElement | null {
  const next = textarea.nextElementSibling;
  if (next instanceof HTMLElement && next.hasAttribute(TOOLBAR_ATTR)) {
    return next;
  }
  return document.querySelector<HTMLElement>(`[${TOOLBAR_ATTR}="true"]`);
}

function createTranslateButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.textContent = defaultButtonLabel;
  return btn;
}

function createOutgoingToolbar(): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = "mc-outgoing-toolbar";
  toolbar.setAttribute(TOOLBAR_ATTR, "true");

  const btn = createTranslateButton();
  btn.addEventListener("click", () => {
    void onTranslateClick(btn);
  });

  toolbar.append(btn);
  return toolbar;
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
      btn.textContent = defaultButtonLabel;
  }
}

function scheduleButtonReset(
  btn: HTMLButtonElement,
  state: "default" | "error",
  delayMs: number,
): void {
  window.setTimeout(() => setButtonState(btn, state), delayMs);
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter) {
    setter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  textarea.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value,
    }),
  );

  if (!invokeReactOnChange(textarea)) {
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function invokeReactOnChange(textarea: HTMLTextAreaElement): boolean {
  const keyed = textarea as HTMLTextAreaElement & Record<string, unknown>;
  const fiberKey = Object.keys(keyed).find(
    (k) =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) return false;

  type FiberNode = {
    memoizedProps?: { onChange?: (e: { target: HTMLTextAreaElement }) => void };
    return?: FiberNode;
  };

  let fiber = keyed[fiberKey] as FiberNode | undefined;
  for (let depth = 0; depth < 12 && fiber; depth++) {
    const onChange = fiber.memoizedProps?.onChange;
    if (typeof onChange === "function") {
      onChange({ target: textarea });
      return true;
    }
    fiber = fiber.return;
  }
  return false;
}

function focusTextareaEnd(textarea: HTMLTextAreaElement): void {
  textarea.focus();
  const len = textarea.value.length;
  textarea.setSelectionRange(len, len);
}

function postTranslateOutgoing(userText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("backend request timed out")),
      REQUEST_TIMEOUT_MS,
    );
    chrome.runtime.sendMessage(
      {
        type: "translate",
        texts: [userText],
        outgoing: true,
      },
      (response: CsTranslateReply | undefined) => {
        window.clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error ?? "backend request failed"));
          return;
        }
        if (response.dryRun) {
          resolve(JSON.stringify({
            dryRun: true,
            note: response.dryRunNote,
            prompt: response.geminiPrompt,
          }));
          return;
        }
        if (!response.translations?.[0]) {
          reject(new Error("backend request failed"));
          return;
        }
        resolve(response.translations[0]);
      },
    );
  });
}

async function onTranslateClick(btn: HTMLButtonElement): Promise<void> {
  const session = await ensureSession();
  if (!session?.organization) {
    setButtonState(btn, "error");
    scheduleButtonReset(btn, "default", ERROR_RESET_MS);
    return;
  }

  const textarea = findComposerTextarea();
  if (!textarea) {
    warn("textarea not found on click");
    return;
  }

  const userText = textarea.value.trim();
  if (!userText) return;

  setButtonState(btn, "loading");
  log("outgoing translate requested (Gemini path)", {
    chars: userText.length,
    userLanguage: session.language,
    orgLanguage: session.organization.language,
    gender: session.gender || "female",
  });

  try {
    const result = (await postTranslateOutgoing(userText)).trim();
    if (result.startsWith("{") && result.includes('"dryRun"')) {
      try {
        const dry = JSON.parse(result) as {
          dryRun?: boolean;
          note?: string;
          prompt?: string;
        };
        if (dry.dryRun && dry.prompt) {
          console.log(
            "%c[ManychatTranslator] GEMINI PROMPT (dry-run)",
            "font-weight:bold;color:#2563eb",
          );
          console.log(dry.prompt);
          console.log(
            "[ManychatTranslator] Also logged in backend terminal where you run: cd backend && npm run dev",
          );
        }
      } catch {
        /* ignore parse */
      }
      btn.textContent = LABEL_DRY_RUN;
      btn.classList.add("success");
      scheduleButtonReset(btn, "default", SUCCESS_RESET_MS * 2);
      return;
    }

    if (!result) {
      setButtonState(btn, "error");
      scheduleButtonReset(btn, "default", ERROR_RESET_MS);
      return;
    }

    const liveTextarea = findComposerTextarea() ?? textarea;
    setTextareaValue(liveTextarea, result);
    focusTextareaEnd(liveTextarea);
    setButtonState(btn, "success");
    scheduleButtonReset(btn, "default", SUCCESS_RESET_MS);
  } catch (err) {
    warn("outgoing translation failed:", err);
    setButtonState(btn, "error");
    scheduleButtonReset(btn, "default", ERROR_RESET_MS);
  }
}

function tryInjectComposerToolbar(): boolean {
  const textarea = findComposerTextarea();
  if (!textarea) return false;
  if (findToolbarForTextarea(textarea)) return false;

  const toolbar = createOutgoingToolbar();
  textarea.insertAdjacentElement("afterend", toolbar);
  void ensureSession().then(() => {
    const btn = toolbar.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
    if (btn) btn.textContent = defaultButtonLabel;
  });
  return true;
}

function isRelevantOutgoingMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (target?.closest?.(`.${BUTTON_CLASS}, .mc-outgoing-toolbar`)) {
    return false;
  }
  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof Element)) continue;
      if (
        node.matches?.(`.${BUTTON_CLASS}, .mc-outgoing-toolbar`) ||
        node.querySelector?.(`.${BUTTON_CLASS}, .mc-outgoing-toolbar`)
      ) {
        continue;
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
    if (tryInjectComposerToolbar()) {
      log(`composer toolbar injected (${reason})`);
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

export function initOutgoing(): void {
  void ensureSession();
  tryInjectComposerToolbar();
  startOutgoingObserver();
  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => tryInjectComposerToolbar(), delay);
  }
}

export function rescanOutgoingComposer(): void {
  tryInjectComposerToolbar();
  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => tryInjectComposerToolbar(), delay);
  }
}
