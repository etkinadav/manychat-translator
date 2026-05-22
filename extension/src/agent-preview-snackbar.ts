/** Top snackbar showing org-language reply mirrored back into the agent's language. */

const SNACKBAR_CLASS = "mc-agent-preview-snackbar";
const AUTO_HIDE_MS = 8000;
const MIN_AGE_ON_LEAVE_MS = 9000;

let snackbarEl: HTMLDivElement | null = null;
let shownAt = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let isHovering = false;

function clearHideTimer(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function hideAgentPreviewSnackbar(): void {
  clearHideTimer();
  snackbarEl?.remove();
  snackbarEl = null;
  isHovering = false;
}

function scheduleHide(): void {
  clearHideTimer();
  const delay = Math.max(0, AUTO_HIDE_MS - (Date.now() - shownAt));
  hideTimer = window.setTimeout(() => {
    if (!isHovering) hideAgentPreviewSnackbar();
  }, delay);
}

function onMouseEnter(): void {
  isHovering = true;
  clearHideTimer();
}

function onMouseLeave(): void {
  isHovering = false;
  if (Date.now() - shownAt >= MIN_AGE_ON_LEAVE_MS) {
    hideAgentPreviewSnackbar();
  } else {
    scheduleHide();
  }
}

function ensureSnackbar(): HTMLDivElement {
  if (snackbarEl?.isConnected) return snackbarEl;

  snackbarEl = document.createElement("div");
  snackbarEl.className = SNACKBAR_CLASS;
  snackbarEl.setAttribute("role", "status");
  snackbarEl.setAttribute("aria-live", "polite");
  snackbarEl.addEventListener("mouseenter", onMouseEnter);
  snackbarEl.addEventListener("mouseleave", onMouseLeave);
  document.body.appendChild(snackbarEl);
  return snackbarEl;
}

/** Show or update the preview snackbar and reset hide timers. */
export function showAgentPreviewSnackbar(text: string): void {
  const el = ensureSnackbar();
  el.textContent = text;
  shownAt = Date.now();
  if (!isHovering) scheduleHide();
}
