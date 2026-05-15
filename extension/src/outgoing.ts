/**
 * Outgoing composer translation — English → Hebrew (gender-aware).
 *
 * Injects a compact toolbar (gender selector + Translate button) next to
 * the Manychat reply textarea. Builds an instruction prompt for Google
 * Translate; the backend strips echoed instruction headers from the result.
 */

const LOG_PREFIX = "[ManychatTranslator:outgoing]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

const TEXTAREA_SELECTOR =
  'textarea[name="whatsappMessageInput"][data-mc-editor="true"]';
const TOOLBAR_ATTR = "data-mc-outgoing-toolbar";
const BUTTON_ATTR = "data-mc-translate-to-hebrew";
const BUTTON_CLASS = "mc-translate-to-hebrew-btn";
const GENDER_INPUT_NAME = "mc-speaker-gender";

type SpeakerGender = "female" | "male";

const LABEL_DEFAULT = "Translate to Hebrew";
const LABEL_LOADING = "Translating...";
const LABEL_SUCCESS = "Translated ✓";
const LABEL_ERROR = "Translation failed";

const OUTGOING_RESCAN_DEBOUNCE_MS = 150;
const POST_NAVIGATION_DELAYS_MS = [200, 600, 1500];
const REQUEST_TIMEOUT_MS = 15000;
const ERROR_RESET_MS = 2000;
const SUCCESS_RESET_MS = 2000;

/** Persisted while the page is open; restored when toolbar is re-injected. */
let selectedGender: SpeakerGender = "female";

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

function findToolbarForTextarea(textarea: HTMLTextAreaElement): HTMLElement | null {
  const next = textarea.nextElementSibling;
  if (next instanceof HTMLElement && next.hasAttribute(TOOLBAR_ATTR)) {
    return next;
  }
  return document.querySelector<HTMLElement>(`[${TOOLBAR_ATTR}="true"]`);
}

function buildTranslationPrompt(userText: string, gender: SpeakerGender): string {
  const speakerLine =
    gender === "female"
      ? "The speaker is female:"
      : "The speaker is male:";
  return `Translate to Hebrew. ${speakerLine}\n${userText}`;
}

function readGenderFromToolbar(toolbar: HTMLElement): SpeakerGender {
  const checked = toolbar.querySelector<HTMLInputElement>(
    `input[name="${GENDER_INPUT_NAME}"]:checked`,
  );
  return checked?.value === "male" ? "male" : "female";
}

function getSelectedGender(): SpeakerGender {
  const toolbar = document.querySelector<HTMLElement>(`[${TOOLBAR_ATTR}="true"]`);
  if (toolbar) return readGenderFromToolbar(toolbar);
  return selectedGender;
}

function createTranslateButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.textContent = LABEL_DEFAULT;
  return btn;
}

function createOutgoingToolbar(): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = "mc-outgoing-toolbar";
  toolbar.setAttribute(TOOLBAR_ATTR, "true");

  const genderWrap = document.createElement("div");
  genderWrap.className = "mc-gender-selector";
  genderWrap.setAttribute("role", "group");
  genderWrap.setAttribute("aria-label", "Speaker gender");

  for (const { value, label } of [
    { value: "female" as const, label: "Female" },
    { value: "male" as const, label: "Male" },
  ]) {
    const labelEl = document.createElement("label");
    labelEl.className = "mc-gender-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = GENDER_INPUT_NAME;
    input.value = value;
    input.checked = selectedGender === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        selectedGender = value;
        log("selected gender:", selectedGender);
      }
    });
    labelEl.append(input, document.createTextNode(` ${label}`));
    genderWrap.appendChild(labelEl);
  }

  const btn = createTranslateButton();
  btn.addEventListener("click", () => {
    void onTranslateClick(btn);
  });

  toolbar.append(genderWrap, btn);
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

function setTextareaValue(
  textarea: HTMLTextAreaElement,
  value: string,
): void {
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

function postTranslateOutgoing(promptText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("backend request timed out")),
      REQUEST_TIMEOUT_MS,
    );
    chrome.runtime.sendMessage(
      {
        type: "translate",
        texts: [promptText],
        targetLanguage: "he",
        stripInstructionPrefix: true,
      },
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

async function onTranslateClick(btn: HTMLButtonElement): Promise<void> {
  const textarea = findComposerTextarea();
  if (!textarea) {
    warn("textarea not found on click");
    return;
  }

  const userText = textarea.value.trim();
  if (!userText) return;

  const gender = getSelectedGender();
  const prompt = buildTranslationPrompt(userText, gender);

  log("outgoing translation started", { gender, userText: userText.slice(0, 60) });
  log("prompt built", { prompt: prompt.slice(0, 120) });
  setButtonState(btn, "loading");

  try {
    const translated = (await postTranslateOutgoing(prompt)).trim();
    log("backend response received", {
      translated: translated.slice(0, 80),
    });

    if (!translated) {
      warn("outgoing translation returned empty — keeping original");
      setButtonState(btn, "error");
      scheduleButtonReset(btn, "default", ERROR_RESET_MS);
      return;
    }

    const liveTextarea = findComposerTextarea() ?? textarea;
    setTextareaValue(liveTextarea, translated);
    focusTextareaEnd(liveTextarea);

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

function tryInjectComposerToolbar(): boolean {
  const textarea = findComposerTextarea();
  if (!textarea) return false;

  if (findToolbarForTextarea(textarea)) return false;

  log("textarea detected");
  const toolbar = createOutgoingToolbar();
  textarea.insertAdjacentElement("afterend", toolbar);
  log("translate button injected (with gender selector)");
  return true;
}

function isRelevantOutgoingMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (
    target?.closest?.(`.${BUTTON_CLASS}, .mc-outgoing-toolbar, .mc-gender-selector`)
  ) {
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
