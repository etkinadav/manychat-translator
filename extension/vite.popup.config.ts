import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync } from "node:fs";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "chrome110",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/popup.ts"),
      output: {
        entryFileNames: "popup.js",
        format: "es",
      },
    },
  },
  plugins: [
    {
      name: "copy-popup-html",
      closeBundle() {
        copyFileSync("popup.html", "dist/popup.html");
      },
    },
  ],
});
