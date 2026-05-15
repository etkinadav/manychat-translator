import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";

/** Content script: single IIFE bundle (no ESM in content scripts). */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "src/content.ts"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
      },
    },
  },
  plugins: [
    {
      name: "copy-extension-static-assets",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("manifest.json", "dist/manifest.json");
        copyFileSync("src/styles.css", "dist/styles.css");
      },
    },
  ],
});
