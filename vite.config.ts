import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  esbuild: { legalComments: "none", pure: ["console.log", "console.debug"], drop: ["debugger"] },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    cssMinify: true,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        // vendor alag chunk: cache hota hai, startup parse halka
        manualChunks(id) {
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
          if (id.includes("node_modules/react")) return "react";
        },
      },
    },
  },
});
