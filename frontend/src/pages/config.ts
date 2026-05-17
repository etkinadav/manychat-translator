import { logout } from "../auth";

export function renderConfig(root: HTMLElement, onLogout: () => void): void {
  root.innerHTML = `
    <div class="config-shell">
      <div class="config-header">
        <h1>קונפיגורציה</h1>
        <button type="button" id="logout-btn">התנתק</button>
      </div>
      <div class="empty-state">
        <p>עמוד הקונפיגורציה — בקרוב.</p>
      </div>
    </div>
  `;

  root.querySelector<HTMLButtonElement>("#logout-btn")!.addEventListener(
    "click",
    () => {
      logout();
      onLogout();
    },
  );
}
