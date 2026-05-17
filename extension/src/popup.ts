import type { ExtensionSession } from "./types";
import { languageLabel } from "./constants/languages";

const errorEl = document.querySelector<HTMLParagraphElement>("#error")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const sessionView = document.querySelector<HTMLDivElement>("#session-view")!;
const loginForm = document.querySelector<HTMLFormElement>("#login-form")!;
const logoutBtn = document.querySelector<HTMLButtonElement>("#logout-btn")!;
const submitBtn = document.querySelector<HTMLButtonElement>("#submit-btn")!;

function showError(msg: string): void {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  statusEl.classList.add("hidden");
}

function showStatus(msg: string): void {
  statusEl.textContent = msg;
  statusEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
}

function clearMessages(): void {
  errorEl.classList.add("hidden");
  statusEl.classList.add("hidden");
}

function renderSession(session: ExtensionSession): void {
  const org = session.organization;
  sessionView.innerHTML = org
    ? `<p><strong>${escapeHtml(session.email)}</strong></p>
       <p>Your language: ${escapeHtml(languageLabel(session.language))}</p>
       <p>Organization: ${escapeHtml(org.name)}</p>
       <p>Translate incoming: ${escapeHtml(languageLabel(org.language))} → ${escapeHtml(languageLabel(session.language))}</p>`
    : `<p><strong>${escapeHtml(session.email)}</strong></p>
       <p class="muted">No organization connected. Open Configuration in the web app.</p>`;
  sessionView.classList.remove("hidden");
  loginForm.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
}

function showLoginForm(): void {
  sessionView.classList.add("hidden");
  loginForm.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
}

async function loadSession(): Promise<void> {
  const res = await chrome.runtime.sendMessage({ type: "getSession" });
  if (res?.ok && res.session) {
    renderSession(res.session as ExtensionSession);
  } else {
    showLoginForm();
  }
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearMessages();
  submitBtn.disabled = true;
  const username = (
    document.querySelector<HTMLInputElement>("#username")?.value ?? ""
  ).trim();
  const password =
    document.querySelector<HTMLInputElement>("#password")?.value ?? "";

  void chrome.runtime
    .sendMessage({ type: "login", username, password })
    .then((res) => {
      submitBtn.disabled = false;
      if (res?.ok) {
        showStatus("Signed in.");
        void loadSession();
      } else {
        showError(res?.error ?? "Login failed");
      }
    });
});

logoutBtn.addEventListener("click", () => {
  void chrome.runtime.sendMessage({ type: "logout" }).then(() => {
    showLoginForm();
    clearMessages();
    loginForm.reset();
  });
});

void loadSession();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
