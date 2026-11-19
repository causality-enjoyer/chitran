import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { createRequire } from "node:module";
// @ts-expect-error type error without @types/node package
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// Node's resolver doesn't use the "browser" condition, so this lands on
// the DOM-free index.js. Workers have no `document`, so we force that build.
const decodeNoDom = createRequire(import.meta.url).resolve(
  "decode-named-character-reference",
);

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    // had to include alias because
    // dococde-named-character-reference ships a DOM-based build under `browser` condition
    // vite bundled this into the worker
    // and the alias forces the DOM-free build.
    alias: [
      { find: /^decode-named-character-reference$/, replacement: decodeNoDom },
    ],
  },
  worker: { format: "es" },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
});
