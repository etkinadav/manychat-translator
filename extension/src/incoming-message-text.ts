/**
 * Resolve original message text nodes inside an incoming message block.
 * Supports reply bubbles with quoted text + new text (e.g. WhatsApp Web).
 */

import { getDomProfile } from "./site-profile/context";

function dom() {
  return getDomProfile();
}

function hasMeaningfulText(el: Element): boolean {
  return (el.textContent ?? "").trim().length > 0;
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

/** Drop outer nodes when a more specific descendant is also in the list. */
function dropContainingAncestors(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter(
    (el) => !elements.some((other) => other !== el && el.contains(other)),
  );
}

function findViaTreeWalker(block: Element): HTMLElement | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      hasDirectText(node as HTMLElement)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });
  const node = walker.nextNode() as HTMLElement | null;
  return node && hasMeaningfulText(node) ? node : null;
}

/**
 * All distinct message text elements in a block (quoted + reply, etc.).
 * Document order is preserved.
 */
export function findTextElementsInBlock(block: Element): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const found: HTMLElement[] = [];

  const add = (el: HTMLElement): void => {
    if (!hasMeaningfulText(el) || seen.has(el)) return;
    seen.add(el);
    found.push(el);
  };

  for (const selector of dom().incoming.textWithinBlock) {
    block.querySelectorAll<HTMLElement>(selector).forEach(add);
  }

  if (found.length === 0) {
    const fallback = findViaTreeWalker(block);
    if (fallback) add(fallback);
  }

  return dropContainingAncestors(found);
}

/** @deprecated Prefer findTextElementsInBlock — kept for single-text callers. */
export function findTextElementInBlock(block: Element): HTMLElement | null {
  return findTextElementsInBlock(block)[0] ?? null;
}
