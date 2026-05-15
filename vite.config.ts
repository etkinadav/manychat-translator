import { defineConfig } from "vite";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";

// Vite is normally for web apps, but for a Chrome MV3 extension we just need
// it to bundle the TypeScript content script into a single ESM-free IIFE file
// and copy the static assets (manifest, css) into the dist/ folder so Chrome
// can load it via "Load unpacked".
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        // Content scripts cannot use ESM imports/exports, so emit a single
        // self-contained IIFE bundle per entry.
        format: "iife",
      },
    },
  },
  plugins: [
    {
      name: "copy-extension-static-assets",
      // Copy manifest.json and styles.css into dist/ at the end of every build
      // so the output folder is a complete, loadable Chrome extension.
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("manifest.json", "dist/manifest.json");
        copyFileSync("src/styles.css", "dist/styles.css");
      },
    },
  ],
});
