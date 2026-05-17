import { startRouter } from "./router";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
  throw new Error("#app element not found");
}

startRouter(app);
