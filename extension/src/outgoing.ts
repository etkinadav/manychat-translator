/**
 * Outgoing composer translation — user language → organization language.
 */

import {
  AUTO_TRANSLATE_STORAGE_KEY,
  readAutoTranslateEnabled,
  writeAutoTranslateEnabled,
} from "./auto-translate";
import { translateToButtonLabel } from "./constants/languages";
import {
  readCustomerGender,
  writeCustomerGender,
  type CustomerGender,
} from "./customer-gender";
import {
  collectConversationTranscript,
  removeConversationSummary,
  showConversationSummary,
} from "./chat-transcript";
import { fetchSession } from "./session-client";
import type { ExtensionSession } from "./types";

const LOG_PREFIX = "[ManychatTranslator:outgoing]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

const TEXTAREA_SELECTOR =
  'textarea[name="whatsappMessageInput"][data-mc-editor="true"]';
const TOOLBAR_ATTR = "data-mc-outgoing-toolbar";
const BUTTON_ATTR = "data-mc-translate-outgoing";
const GENDER_ATTR = "data-mc-customer-gender";
const BUTTON_CLASS = "mc-translate-to-hebrew-btn";
const SUMMARY_BTN_CLASS = "mc-conversation-summary-btn";
const SUMMARY_BTN_ATTR = "data-mc-summary-toolbar-btn";
const AUTO_TRANSLATE_BTN_CLASS = "mc-auto-translate-toggle";
const AUTO_TRANSLATE_BTN_ATTR = "data-mc-auto-translate-toggle";

const LABEL_LOADING = "Translating...";
const LABEL_SUMMARY_LOADING = "Summarizing...";
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
  return null;
}

function removeOrphanedToolbars(activeTextarea: HTMLTextAreaElement): void {
  for (const toolbar of document.querySelectorAll<HTMLElement>(
    `[${TOOLBAR_ATTR}="true"]`,
  )) {
    if (toolbar.previousElementSibling !== activeTextarea) {
      toolbar.remove();
    }
  }
}

function syncToolbarSession(toolbar: HTMLElement): void {
  void ensureSession().then((session) => {
    const hasOrg = Boolean(session?.organization);
    const translateBtn = toolbar.querySelector<HTMLButtonElement>(
      `.${BUTTON_CLASS}`,
    );
    const summaryBtn = toolbar.querySelector<HTMLButtonElement>(
      `.${SUMMARY_BTN_CLASS}`,
    );
    const autoBtn = toolbar.querySelector<HTMLButtonElement>(
      `.${AUTO_TRANSLATE_BTN_CLASS}`,
    );
    if (translateBtn) {
      translateBtn.textContent = defaultButtonLabel;
      translateBtn.disabled = !hasOrg;
    }
    if (summaryBtn) summaryBtn.disabled = !hasOrg;
    if (autoBtn) autoBtn.disabled = !hasOrg;
    syncAutoTranslateToggle(toolbar);
  });
}

function ensureToolbarButtons(toolbar: HTMLElement): void {
  if (!toolbar.querySelector(`.${AUTO_TRANSLATE_BTN_CLASS}`)) {
    toolbar.prepend(createAutoTranslateToggle());
  }
  if (!toolbar.querySelector(`.${BUTTON_CLASS}`)) {
    const btn = createTranslateButton();
    btn.addEventListener("click", () => {
      void onTranslateClick(btn);
    });
    const autoBtn = toolbar.querySelector(`.${AUTO_TRANSLATE_BTN_CLASS}`);
    if (autoBtn) autoBtn.insertAdjacentElement("afterend", btn);
    else toolbar.append(btn);
  }
  if (!toolbar.querySelector(`.${SUMMARY_BTN_CLASS}`)) {
    toolbar.append(createSummaryButton());
  }
}

interface ConversationSummaryReply {
  ok: boolean;
  conversationSummary?: string;
  error?: string;
}

function postConversationSummary(transcript: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "conversationSummary",
        conversationTranscript: transcript,
      },
      (response: ConversationSummaryReply | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok || !response.conversationSummary) {
          reject(new Error(response?.error ?? "conversation summary failed"));
          return;
        }
        resolve(response.conversationSummary);
      },
    );
  });
}

function applyAutoTranslateButtonState(
  btn: HTMLButtonElement,
  enabled: boolean,
): void {
  btn.classList.toggle("active", enabled);
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.textContent = enabled ? "auto" : "off";
  btn.title = enabled
    ? "Automatic chat translation is on (click to turn off)"
    : "Automatic chat translation is off (click to turn on)";
}

function createAutoTranslateToggle(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = AUTO_TRANSLATE_BTN_CLASS;
  btn.setAttribute(AUTO_TRANSLATE_BTN_ATTR, "true");
  applyAutoTranslateButtonState(btn, true);
  btn.addEventListener("click", () => {
    void (async () => {
      const enabled = await readAutoTranslateEnabled();
      const next = !enabled;
      await writeAutoTranslateEnabled(next);
      applyAutoTranslateButtonState(btn, next);
    })();
  });
  void readAutoTranslateEnabled().then((enabled) => {
    applyAutoTranslateButtonState(btn, enabled);
  });
  return btn;
}

function syncAutoTranslateToggle(toolbar: HTMLElement): void {
  const btn = toolbar.querySelector<HTMLButtonElement>(
    `.${AUTO_TRANSLATE_BTN_CLASS}`,
  );
  if (!btn) return;
  void readAutoTranslateEnabled().then((enabled) => {
    applyAutoTranslateButtonState(btn, enabled);
  });
}

function createSummaryButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = SUMMARY_BTN_CLASS;
  btn.setAttribute(SUMMARY_BTN_ATTR, "true");
  btn.textContent = "summery";
  btn.title = "Summarize translated conversation (Gemini)";
  btn.addEventListener("click", () => {
    void onConversationSummaryClick(btn);
  });
  return btn;
}

async function onConversationSummaryClick(btn: HTMLButtonElement): Promise<void> {
  const session = await ensureSession();
  if (!session?.organization) {
    btn.classList.add("error");
    btn.textContent = "No org";
    window.setTimeout(() => {
      btn.classList.remove("error");
      btn.textContent = "summery";
    }, ERROR_RESET_MS);
    return;
  }

  const transcript = await collectConversationTranscript();
  if (!transcript) {
    btn.classList.add("error");
    btn.textContent = "No messages";
    window.setTimeout(() => {
      btn.classList.remove("error");
      btn.textContent = "summery";
    }, ERROR_RESET_MS);
    return;
  }

  const prevLabel = btn.textContent;
  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = LABEL_SUMMARY_LOADING;
  removeConversationSummary();

  log("conversation summary requested", { chars: transcript.length });

  try {
    const summary = await postConversationSummary(transcript);
    showConversationSummary(summary);
    ensureComposerToolbar();
    btn.classList.remove("loading");
    btn.classList.add("success");
    btn.textContent = "Summary ✓";
    window.setTimeout(() => {
      btn.classList.remove("success");
      btn.textContent = prevLabel ?? "summery";
      btn.disabled = false;
    }, SUCCESS_RESET_MS * 2);
  } catch (err) {
    warn("conversation summary failed:", err);
    btn.classList.remove("loading");
    btn.classList.add("error");
    btn.textContent = "Summary failed";
    window.setTimeout(() => {
      btn.classList.remove("error");
      btn.textContent = prevLabel ?? "summery";
      btn.disabled = false;
    }, ERROR_RESET_MS);
  }
}

function createTranslateButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.textContent = defaultButtonLabel;
  return btn;
}

function readCustomerGenderFromToolbar(
  toolbar: HTMLElement,
): CustomerGender {
  const selected = toolbar.querySelector<HTMLInputElement>(
    `input[name="${GENDER_ATTR}"]:checked`,
  );
  return selected?.value === "female" ? "female" : "male";
}

function createCustomerGenderSelector(
  initial: CustomerGender,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "mc-gender-selector";
  wrap.title = "Customer gender (for translation tone)";

  const makeOption = (value: CustomerGender, label: string): HTMLLabelElement => {
    const labelEl = document.createElement("label");
    labelEl.className = "mc-gender-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = GENDER_ATTR;
    input.value = value;
    input.checked = initial === value;
    input.addEventListener("change", () => {
      if (input.checked) void writeCustomerGender(value);
    });
    labelEl.append(input, document.createTextNode(` ${label}`));
    return labelEl;
  };

  wrap.append(makeOption("male", "Male"), makeOption("female", "Female"));
  return wrap;
}

function createOutgoingToolbar(): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = "mc-outgoing-toolbar";
  toolbar.setAttribute(TOOLBAR_ATTR, "true");

  const btn = createTranslateButton();
  btn.addEventListener("click", () => {
    void onTranslateClick(btn);
  });

  const summaryBtn = createSummaryButton();
  const autoBtn = createAutoTranslateToggle();

  void ensureSession().then((session) => {
    const hasOrg = Boolean(session?.organization);
    btn.disabled = !hasOrg;
    summaryBtn.disabled = !hasOrg;
    autoBtn.disabled = !hasOrg;
    void readCustomerGender().then((gender) => {
      const genderEl = createCustomerGenderSelector(gender);
      if (!hasOrg) {
        genderEl.querySelectorAll("input").forEach((input) => {
          input.disabled = true;
        });
      }
      toolbar.prepend(genderEl);
    });
  });

  toolbar.append(autoBtn, btn, summaryBtn);
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

function logGeminiPromptInPage(prompt: string): void {
  console.log(
    "%c[ManychatTranslator] GEMINI PROMPT",
    "font-weight:bold;color:#2563eb",
  );
  console.log(prompt);
  console.log(
    "[ManychatTranslator] Same prompt logged in backend terminal (npm run dev)",
  );
}

interface OutgoingTranslateResult {
  translation: string;
  geminiPrompt?: string;
  dryRun?: boolean;
}

function postTranslateOutgoing(
  userText: string,
  customerGender: CustomerGender,
): Promise<OutgoingTranslateResult> {
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
        customerGender,
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
          resolve({
            translation: response.translations?.[0] ?? userText,
            geminiPrompt: response.geminiPrompt,
            dryRun: true,
          });
          return;
        }
        if (!response.translations?.[0]) {
          reject(new Error("backend request failed"));
          return;
        }
        resolve({
          translation: response.translations[0],
          geminiPrompt: response.geminiPrompt,
        });
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

  const toolbar = btn.closest<HTMLElement>(`[${TOOLBAR_ATTR}]`);
  const customerGender = toolbar
    ? readCustomerGenderFromToolbar(toolbar)
    : await readCustomerGender();

  setButtonState(btn, "loading");
  log("outgoing translate requested (Gemini path)", {
    chars: userText.length,
    userLanguage: session.language,
    orgLanguage: session.organization.language,
    agentGender: session.gender || "male",
    customerGender,
  });

  try {
    const { translation, geminiPrompt, dryRun } = await postTranslateOutgoing(
      userText,
      customerGender,
    );

    if (geminiPrompt) {
      logGeminiPromptInPage(geminiPrompt);
    }

    if (dryRun) {
      btn.textContent = LABEL_DRY_RUN;
      btn.classList.add("success");
      scheduleButtonReset(btn, "default", SUCCESS_RESET_MS * 2);
      return;
    }

    const translated = translation.trim();
    if (!translated) {
      setButtonState(btn, "error");
      scheduleButtonReset(btn, "default", ERROR_RESET_MS);
      return;
    }

    const liveTextarea = findComposerTextarea() ?? textarea;
    setTextareaValue(liveTextarea, translated);
    focusTextareaEnd(liveTextarea);
    setButtonState(btn, "success");
    scheduleButtonReset(btn, "default", SUCCESS_RESET_MS);
  } catch (err) {
    warn("outgoing translation failed:", err);
    setButtonState(btn, "error");
    scheduleButtonReset(btn, "default", ERROR_RESET_MS);
  }
}

function ensureComposerToolbar(): boolean {
  const textarea = findComposerTextarea();
  if (!textarea) return false;

  removeOrphanedToolbars(textarea);

  const existing = findToolbarForTextarea(textarea);
  if (existing) {
    ensureToolbarButtons(existing);
    syncToolbarSession(existing);
    return true;
  }

  const toolbar = createOutgoingToolbar();
  textarea.insertAdjacentElement("afterend", toolbar);
  syncToolbarSession(toolbar);
  return true;
}

function isRelevantOutgoingMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (
    target?.closest?.(
      `.${BUTTON_CLASS}, .${SUMMARY_BTN_CLASS}, .${AUTO_TRANSLATE_BTN_CLASS}, .mc-outgoing-toolbar`,
    )
  ) {
    return false;
  }
  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof Element)) continue;
      if (
        node.matches?.(
          `.${BUTTON_CLASS}, .${SUMMARY_BTN_CLASS}, .${AUTO_TRANSLATE_BTN_CLASS}, .mc-outgoing-toolbar`,
        ) ||
        node.querySelector?.(
          `.${BUTTON_CLASS}, .${SUMMARY_BTN_CLASS}, .${AUTO_TRANSLATE_BTN_CLASS}, .mc-outgoing-toolbar`,
        )
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
    if (ensureComposerToolbar()) {
      log(`composer toolbar ensured (${reason})`);
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

const TOOLBAR_KEEPALIVE_MS = 2000;

export function initOutgoing(): void {
  void ensureSession();
  ensureComposerToolbar();
  startOutgoingObserver();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[AUTO_TRANSLATE_STORAGE_KEY]) return;
    const enabled = changes[AUTO_TRANSLATE_STORAGE_KEY].newValue !== false;
    document
      .querySelectorAll<HTMLButtonElement>(`.${AUTO_TRANSLATE_BTN_CLASS}`)
      .forEach((btn) => applyAutoTranslateButtonState(btn, enabled));
  });

  window.setInterval(() => {
    ensureComposerToolbar();
  }, TOOLBAR_KEEPALIVE_MS);

  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => ensureComposerToolbar(), delay);
  }
}

export function rescanOutgoingComposer(): void {
  ensureComposerToolbar();
  for (const delay of POST_NAVIGATION_DELAYS_MS) {
    window.setTimeout(() => ensureComposerToolbar(), delay);
  }
}
