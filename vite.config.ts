import { copyFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { STOCKFISH_ASSET_DIR, STOCKFISH_JS_FILE, STOCKFISH_WASM_FILE } from "./frontend/src/constants.ts";

// The backend port for `pnpm dev`. The websocket and the health route proxy to it.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const FRONTEND_DEV_PORT = 5173;
const STOCKFISH_PACKAGE_JSON = "stockfish/package.json";
const STOCKFISH_BIN_DIR = "bin";
const CONTENT_TYPE_JS = "text/javascript; charset=utf-8";
const CONTENT_TYPE_WASM = "application/wasm";
const QUERY_SEPARATOR = "?";
const STOCKFISH_MIME = {
  [STOCKFISH_JS_FILE]: CONTENT_TYPE_JS,
  [STOCKFISH_WASM_FILE]: CONTENT_TYPE_WASM,
} as const;
const STOCKFISH_FILES = [STOCKFISH_JS_FILE, STOCKFISH_WASM_FILE] as const;

function stockfishSourceDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve(STOCKFISH_PACKAGE_JSON)), STOCKFISH_BIN_DIR);
}

function stockfishPublicPath(file: string): string {
  return `/${STOCKFISH_ASSET_DIR}/${file}`;
}

function requestPath(url: string | undefined): string {
  return (url ?? "").split(QUERY_SEPARATOR)[0] ?? "";
}

/** Serves the lite single-thread engine on /chess only after the Worker is created. */
function stockfishAssets(): Plugin {
  return {
    name: "stockfish-assets",
    configureServer(server) {
      const sourceDir = stockfishSourceDir();
      server.middlewares.use((request, response, next) => {
        const path = requestPath(request.url);
        for (const file of STOCKFISH_FILES) {
          if (path !== stockfishPublicPath(file)) {
            continue;
          }
          const source = join(sourceDir, file);
          if (!existsSync(source)) {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader("Content-Type", STOCKFISH_MIME[file]);
          createReadStream(source).pipe(response);
          return;
        }
        next();
      });
    },
    writeBundle(options) {
      if (options.dir === undefined) {
        return;
      }
      const sourceDir = stockfishSourceDir();
      const destDir = join(options.dir, STOCKFISH_ASSET_DIR);
      mkdirSync(destDir, { recursive: true });
      for (const file of STOCKFISH_FILES) {
        copyFileSync(join(sourceDir, file), join(destDir, file));
      }
    },
  };
}

export default defineConfig({
  root: "frontend",
  plugins: [react(), stockfishAssets()],
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
