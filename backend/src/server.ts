import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import type { ServerMessage } from "../../shared/src/index.ts";
import { HEALTH_BODY, HEALTH_PATH, MESSAGE_TYPE, WS_PATH } from "../../shared/src/index.ts";
import type { Config } from "./config.ts";
import { answerClientMessage, peekGameId } from "./dispatch.ts";
import { JevClient } from "./jev.ts";

// region: static files
const INDEX_FILE = "index.html";
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".wasm": "application/wasm",
};
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

function serveStatic(staticDir: string, request: IncomingMessage, response: ServerResponse): void {
  const root = resolve(staticDir);
  const url = new URL(request.url ?? "/", "http://localhost");
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, relative);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    // Single page app: every unknown path answers index.html.
    file = join(root, INDEX_FILE);
  }
  if (!existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("frontend build not found, run `pnpm build`");
    return;
  }
  response.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(file)] ?? DEFAULT_CONTENT_TYPE });
  createReadStream(file).pipe(response);
}
// endregion: static files

// region: websocket
function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function attachWebSocket(server: Server, client: JevClient): WebSocketServer {
  const wss = new WebSocketServer({ server, path: WS_PATH });
  wss.on("connection", (socket) => {
    socket.on("message", async (raw) => {
      const text = raw.toString();
      const gameId = peekGameId(text);
      try {
        const answer = await answerClientMessage(client, text);
        send(socket, answer);
        if (answer.type === MESSAGE_TYPE.decision) {
          console.info(
            JSON.stringify({
              event: "decision",
              game_id: answer.game_id,
              move: answer.move,
              probability: answer.probability,
              confidence: answer.confidence,
              options: answer.options_considered,
              latency_ms: answer.latency_ms,
            }),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ event: "error", game_id: gameId, message }));
        send(socket, { type: MESSAGE_TYPE.error, game_id: gameId, message });
      }
    });
  });
  return wss;
}
// endregion: websocket

// region: http
export function createApp(config: Config): Server {
  const client = new JevClient({
    apiKey: config.openrouterApiKey,
    url: config.openrouterUrl,
    model: config.jevModel,
  });
  const server = createServer((request, response) => {
    if (request.url === HEALTH_PATH) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(HEALTH_BODY);
      return;
    }
    serveStatic(config.staticDir, request, response);
  });
  attachWebSocket(server, client);
  return server;
}

export function startServer(config: Config): Server {
  const server = createApp(config);
  server.listen(config.port, config.host, () => {
    console.info(JSON.stringify({ event: "listening", host: config.host, port: config.port, model: config.jevModel }));
  });
  return server;
}
// endregion: http
