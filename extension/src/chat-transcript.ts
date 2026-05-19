/**
 * Collect chat lines for conversation summary and render summary in the thread.
 */

import { readAutoTranslateEnabled } from "./auto-translate";

const MESSAGE_BLOCK_SELECTOR = '[data-chat-message="block"]';
const WRAPPER_SELECTOR = '[class*="_wrapper_"]';
const SKIP_BLOCK_SELECTOR =
  '[class*="_meta_"], [data-chat-message="meta"], [data-chat-message="system"], [class*="_system_"]';
const TEXT_NODE_SELECTORS = [
  '[data-chat-message="text"]',
  '[class*="_text_"]',
];
const TRANSLATION_CLASS = "mc-ai-translation";
const STATUS_ATTR = "data-ai-translation-status";
const GEMINI_RESULT_CLASS = "mc-ai-gemini-result";
const PROCESSED_ATTR = "data-ai-processed";

export const CONVERSATION_SUMMARY_CLASS = "mc-conversation-summary";
/** In-thread summary block only — must not match the composer toolbar button. */
export const SUMMARY_ATTR = "data-mc-chat-summary";

function hasMeaningfulText(el: Element): boolean {
  return (el.textContent ?? "").trim().length > 0;
}

function findTextElementInBlock(block: Element): HTMLElement | null {
  for (const selector of TEXT_NODE_SELECTORS) {
    const candidate = block.querySelector<HTMLElement>(selector);
    if (candidate && hasMeaningfulText(candidate)) return candidate;
  }
  return null;
}

function isSkippableMessageBlock(block: Element): boolean {
  return block.matches(SKIP_BLOCK_SELECTOR);
}

function detectSpeaker(block: Element): string {
  const blob = `${block.className} ${block.getAttribute("class") ?? ""} ${
    block.parentElement?.className ?? ""
  }`.toLowerCase();
  if (
    /outgoing|from-agent|agent-message|_out_|sent-by-user|message-out|_typeout|_botmessage/.test(
      blob,
    )
  ) {
    return "Agent";
  }
  if (
    /incoming|from-subscriber|customer|subscriber|message-in|received|_typein/.test(
      blob,
    )
  ) {
    return "Customer";
  }
  return "Unknown";
}

function getTranslationText(placeholder: HTMLElement): string {
  const google =
    placeholder.querySelector<HTMLElement>(".mc-ai-google-text")?.textContent?.trim() ??
    placeholder.textContent?.trim() ??
    "";
  const geminiSibling = placeholder.nextElementSibling;
  if (
    geminiSibling instanceof HTMLElement &&
    geminiSibling.classList.contains(GEMINI_RESULT_CLASS)
  ) {
    const gemini = geminiSibling.textContent?.trim();
    if (gemini && gemini !== "AI translating…") {
      return `${google} [AI retranslation: ${gemini}]`;
    }
  }
  return google;
}

function getLastChatMessageBlock(): HTMLElement | null {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>(MESSAGE_BLOCK_SELECTOR),
  ).filter((b) => !isSkippableMessageBlock(b));
  return blocks[blocks.length - 1] ?? null;
}

function formatTranscriptEntry(
  index: number,
  speaker: string,
  original: string,
  translation?: string,
): string {
  if (translation) {
    return `[${index}] ${speaker}\nOriginal: ${original}\nTranslation: ${translation}`;
  }
  return `[${index}] ${speaker}\nMessage: ${original}`;
}

/**
 * Build transcript for Gemini summary. When auto-translate is on, uses completed
 * translations; when off, uses original message text only.
 */
export async function collectConversationTranscript(): Promise<string | null> {
  const useTranslations = await readAutoTranslateEnabled();
  const blocks = document.querySelectorAll(MESSAGE_BLOCK_SELECTOR);
  const entries: string[] = [];
  let index = 0;

  for (const block of Array.from(blocks)) {
    if (isSkippableMessageBlock(block)) continue;

    const textEl = findTextElementInBlock(block);
    if (!textEl) continue;

    const original = (textEl.textContent ?? "").trim();
    if (!original) continue;

    const speaker = detectSpeaker(block);

    if (useTranslations) {
      const placeholder = textEl.nextElementSibling;
      if (
        !(placeholder instanceof HTMLElement) ||
        !placeholder.classList.contains(TRANSLATION_CLASS) ||
        placeholder.getAttribute(STATUS_ATTR) !== "done"
      ) {
        continue;
      }

      const translation = getTranslationText(placeholder);
      if (!translation) continue;

      index += 1;
      entries.push(formatTranscriptEntry(index, speaker, original, translation));
      continue;
    }

    index += 1;
    entries.push(formatTranscriptEntry(index, speaker, original));
  }

  if (entries.length === 0) return null;
  return entries.join("\n\n");
}

export function removeConversationSummary(): void {
  document
    .querySelectorAll(`[${SUMMARY_ATTR}]`)
    .forEach((el) => el.remove());
}

function stripMessageContent(wrapper: HTMLElement): void {
  wrapper
    .querySelectorAll(
      `.${TRANSLATION_CLASS}, .${GEMINI_RESULT_CLASS}, .${CONVERSATION_SUMMARY_CLASS}, [${PROCESSED_ATTR}]`,
    )
    .forEach((el) => el.remove());

  wrapper.querySelectorAll(MESSAGE_BLOCK_SELECTOR).forEach((block) => {
    const textEl = findTextElementInBlock(block);
    if (textEl) {
      textEl.textContent = "";
      textEl.removeAttribute(PROCESSED_ATTR);
    }
  });
}

function buildSummaryInner(summaryText: string): HTMLElement {
  const translation = document.createElement("motion.div");
  translation.className = `${TRANSLATION_CLASS} updated ${CONVERSATION_SUMMARY_CLASS}`;
  translation.setAttribute("data-ai-translated", "true");
  translation.setAttribute(STATUS_ATTR, "done");
  translation.setAttribute("data-mc-summary-body", "true");

  const row = document.createElement("motion.div");
  row.className = "mc-ai-translation-row";

  const text = document.createElement("span");
  text.className = "mc-ai-google-text";
  text.style.whiteSpace = "pre-wrap";
  text.textContent = summaryText.trim();

  row.append(text);
  translation.append(row);
  return translation;
}

/**
 * Clone Manychat's outbound message wrapper and place the summary inside its block.
 */
function buildSummaryMessageWrapper(
  templateWrapper: HTMLElement,
  summaryText: string,
): HTMLElement {
  const wrapper = templateWrapper.cloneNode(true) as HTMLElement;
  wrapper.setAttribute(SUMMARY_ATTR, "true");
  stripMessageContent(wrapper);

  const block =
    wrapper.querySelector<HTMLElement>(MESSAGE_BLOCK_SELECTOR) ??
    wrapper.querySelector<HTMLElement>('[class*="_block_"]');

  if (!block) {
    const fallback = document.createElement("div");
    fallback.className = CONVERSATION_SUMMARY_CLASS;
    fallback.setAttribute(SUMMARY_ATTR, "true");
    fallback.append(buildSummaryInner(summaryText));
    return fallback;
  }

  block.innerHTML = "";
  block.removeAttribute(PROCESSED_ATTR);
  block.append(buildSummaryInner(summaryText));
  return wrapper;
}

function showConversationSummaryFallback(summaryText: string): void {
  const anchor = getLastChatMessageBlock();
  if (!anchor) return;

  const wrap = document.createElement("div");
  wrap.className = CONVERSATION_SUMMARY_CLASS;
  wrap.setAttribute(SUMMARY_ATTR, "true");
  wrap.append(buildSummaryInner(summaryText));
  anchor.insertAdjacentElement("afterend", wrap);
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function showConversationSummary(summaryText: string): void {
  removeConversationSummary();

  const lastBlock = getLastChatMessageBlock();
  if (!lastBlock) return;

  const templateWrapper = lastBlock.closest<HTMLElement>(WRAPPER_SELECTOR);
  if (!templateWrapper?.parentElement) {
    showConversationSummaryFallback(summaryText);
    return;
  }

  const summaryWrapper = buildSummaryMessageWrapper(
    templateWrapper,
    summaryText,
  );
  templateWrapper.parentElement.insertBefore(
    summaryWrapper,
    templateWrapper.nextSibling,
  );
  summaryWrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
