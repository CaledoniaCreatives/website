import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// package.json has "type": "module", so this file runs as ESM —
// __dirname isn't available there, hence the import.meta.url dance.
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2020",
    cssCodeSplit: false,
    // Multi-page: index (homepage), about, services, contact. Each is
    // its own HTML entry sharing /src/main.js and /src/index.css — add
    // more entries here once Work has real case studies to show.
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "about.html"),
        services: resolve(__dirname, "services.html"),
        contact: resolve(__dirname, "contact.html"),
      },
    },
  },
});
