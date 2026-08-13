import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8788", timeout: 180_000 },
      "/media": { target: "http://127.0.0.1:8788", timeout: 180_000 },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
