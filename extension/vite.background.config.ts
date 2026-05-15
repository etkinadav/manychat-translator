import { defineConfig } from "vite";
import { resolve } from "node:path";

/** Service worker: ES module (manifest background.type = "module"). */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome110",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/background.ts"),
      output: {
        entryFileNames: "background.js",
        format: "es",
      },
    },
  },
});
