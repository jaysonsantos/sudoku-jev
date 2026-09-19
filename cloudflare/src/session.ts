import { DurableObject } from "cloudflare:workers";
import { JevClient } from "../../backend/src/jev.ts";
import { STATUS } from "./constants.ts";
import type { WorkerEnv } from "./env.ts";
import { respondToSocketText, textFromSocketMessage } from "./handle.ts";

function clientFromEnv(env: WorkerEnv): JevClient {
  return new JevClient({
    apiKey: env.OPENROUTER_API_KEY,
    url: env.OPENROUTER_URL,
    model: env.JEV_MODEL,
  });
}

/** One hibernatable WebSocket per browser session. Each state message is a full board. */
export class GameSession extends DurableObject<WorkerEnv> {
  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    if (client === undefined || server === undefined) {
      return new Response(null, { status: STATUS.serverError });
    }
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: STATUS.switchingProtocols, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const answer = await respondToSocketText(clientFromEnv(this.env), textFromSocketMessage(message));
    socket.send(JSON.stringify(answer));
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    socket.close(code, reason);
  }
}
