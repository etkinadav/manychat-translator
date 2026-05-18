/**
 * Subscriber name gender — button next to Manychat contact title.
 */

import { fetchSession } from "./session-client";

const LOG_PREFIX = "[ManychatTranslator:subscriber-gender]";
const log = (...args: unknown[]) => console.log(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

const SUBSCRIBER_TITLE_SELECTOR = 'span[class*="_subscriberTitle_"]';
const INJECTED_ATTR = "data-mc-subscriber-gender";
const BTN_CLASS = "mc-subscriber-gender-btn";
const VALID_RESULTS = new Set([
  "male",
  "female",
  "male or female",
  "unknown",
]);

const processedTitles = new WeakSet<HTMLElement>();
let observer: MutationObserver | null = null;

type NameGenderCategory = "male" | "female" | "male or female" | "unknown";

interface NameGenderReply {
  ok: boolean;
  nameGender?: NameGenderCategory;
  error?: string;
}

async function isOrganizationConnected(): Promise<boolean> {
  try {
    const session = await fetchSession(false);
    return Boolean(session.organization);
  } catch {
    return false;
  }
}

function postDetectNameGender(name: string): Promise<NameGenderCategory> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "detectNameGender",
        subscriberName: name,
      },
      (response: NameGenderReply | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok || !response.nameGender) {
          reject(new Error(response?.error ?? "name gender request failed"));
          return;
        }
        resolve(response.nameGender);
      },
    );
  });
}

function setButtonResult(btn: HTMLButtonElement, value: string): void {
  btn.textContent = value;
  btn.classList.remove("loading");
  btn.disabled = true;
  if (value === "error") {
    btn.classList.add("error");
  } else {
    btn.classList.add("done");
  }
}

async function onGenderButtonClick(
  btn: HTMLButtonElement,
  subscriberName: string,
): Promise<void> {
  if (btn.disabled && btn.classList.contains("done")) return;

  const connected = await isOrganizationConnected();
  if (!connected) {
    setButtonResult(btn, "error");
    return;
  }

  btn.disabled = true;
  btn.classList.add("loading");
  btn.textContent = "…";

  try {
    const result = await postDetectNameGender(subscriberName);
    if (VALID_RESULTS.has(result)) {
      setButtonResult(btn, result);
      log("result", { name: subscriberName, result });
    } else {
      setButtonResult(btn, "error");
    }
  } catch (err) {
    warn("detect failed:", err);
    setButtonResult(btn, "error");
  }
}

function injectGenderButton(titleEl: HTMLElement): boolean {
  if (processedTitles.has(titleEl)) return false;
  if (titleEl.hasAttribute(INJECTED_ATTR)) {
    processedTitles.add(titleEl);
    return false;
  }

  const name = (titleEl.textContent ?? "").trim();
  if (!name) return false;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.textContent = "gender";
  btn.title = "Detect name gender (Gemini)";
  btn.setAttribute("aria-label", "Detect subscriber name gender");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void onGenderButtonClick(btn, name);
  });

  titleEl.setAttribute(INJECTED_ATTR, "true");
  titleEl.insertAdjacentElement("afterend", btn);
  processedTitles.add(titleEl);

  void isOrganizationConnected().then((connected) => {
    if (!connected) {
      btn.disabled = true;
      btn.title = "Connect to an organization in Configuration first";
    }
  });

  return true;
}

function scanSubscriberTitles(root: ParentNode = document): number {
  let injected = 0;
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>(SUBSCRIBER_TITLE_SELECTOR),
  )) {
    if (injectGenderButton(el)) injected++;
  }
  return injected;
}

function isRelevantMutation(mutation: MutationRecord): boolean {
  const target = mutation.target as Element | null;
  if (target?.closest?.(`.${BTN_CLASS}`)) return false;

  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof Element)) continue;
      if (node.matches?.(SUBSCRIBER_TITLE_SELECTOR)) return true;
      if (node.querySelector?.(SUBSCRIBER_TITLE_SELECTOR)) return true;
    }
    return false;
  }
  return false;
}

function startSubscriberGenderObserver(): void {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (isRelevantMutation(m)) {
        scanSubscriberTitles();
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initSubscriberGender(): void {
  const count = scanSubscriberTitles();
  if (count > 0) {
    log(`injected gender button on ${count} subscriber title(s)`);
  }
  startSubscriberGenderObserver();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes["mct-session"] || changes["mct-auth"]) {
      scanSubscriberTitles();
    }
  });
}

export function rescanSubscriberGender(): void {
  scanSubscriberTitles();
}
