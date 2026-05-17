import { isAuthenticated } from "./auth";
import { renderConfig } from "./pages/config";
import { renderLogin } from "./pages/login";

const CONFIG_PATH = "/config";

export function startRouter(app: HTMLElement): void {
  function navigate(path: string, replace = false): void {
    if (replace) {
      history.replaceState({}, "", path);
    } else {
      history.pushState({}, "", path);
    }
    render();
  }

  function render(): void {
    const path = window.location.pathname;

    if (path === CONFIG_PATH) {
      if (!isAuthenticated()) {
        navigate("/", true);
        return;
      }
      app.className = "";
      renderConfig(app, () => navigate("/"));
      return;
    }

    if (isAuthenticated()) {
      navigate(CONFIG_PATH, true);
      return;
    }

    app.className = "";
    renderLogin(app, () => navigate(CONFIG_PATH));
  }

  window.addEventListener("popstate", () => render());
  render();
}
