import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The backend port for `pnpm dev`. The websocket and the health route proxy to it.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const FRONTEND_DEV_PORT = 5173;

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: FRONTEND_DEV_PORT,
    proxy: {
      "/ws": { target: BACKEND_URL, ws: true },
      "/healthz": { target: BACKEND_URL },
    },
  },
});
