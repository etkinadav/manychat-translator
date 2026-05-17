import { login } from "../auth";

export function renderLogin(root: HTMLElement, onSuccess: () => void): void {
  root.innerHTML = `
    <div class="card">
      <h1>התחברות</h1>
      <p class="subtitle">Manychat Translator</p>
      <p class="error" id="login-error" hidden></p>
      <form id="login-form">
        <div class="field">
          <label for="username">שם משתמש</label>
          <input id="username" name="username" type="text" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">סיסמה</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button type="submit" id="login-submit">Log in</button>
      </form>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>("#login-form")!;
  const errorEl = root.querySelector<HTMLParagraphElement>("#login-error")!;
  const submitBtn = root.querySelector<HTMLButtonElement>("#login-submit")!;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      errorEl.hidden = true;
      submitBtn.disabled = true;
      const fd = new FormData(form);
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");

      try {
        await login(username, password);
        onSuccess();
      } catch (err) {
        errorEl.textContent =
          err instanceof Error ? err.message : "ההתחברות נכשלה";
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    })();
  });
}
