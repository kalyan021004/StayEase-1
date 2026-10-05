import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api is proxied to the backend so the browser sees one origin
// (no CORS setup needed locally). Override the target with API_PROXY_TARGET
// (docker-compose sets it to http://api:5000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET || "http://localhost:5000", changeOrigin: true },
    },
  },
  build: { sourcemap: true },
});
