import { DurableObject } from "cloudflare:workers";
import { JevClient } from "../../backend/src/jev.ts";
import { MESSAGE_TYPE } from "../../shared/src/index.ts";
import { BODY, STATUS } from "./constants.ts";
import { readSecret, type WorkerEnv } from "./env.ts";
import { respondToSocketText, textFromSocketMessage } from "./handle.ts";

function clientFromEnv(env: WorkerEnv): JevClient {
  return new JevClient({
    apiKey: readSecret(env.OPENROUTER_API_KEY),
    url: env.OPENROUTER_URL,
    model: env.JEV_MODEL,
  });
}

function missingKeyMessage(): string {
  return JSON.stringify({
    type: MESSAGE_TYPE.error,
    game_id: null,
    message: BODY.missingApiKey,
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
    if (readSecret(this.env.OPENROUTER_API_KEY).length === 0) {
      socket.send(missingKeyMessage());
      return;
    }
    const answer = await respondToSocketText(clientFromEnv(this.env), textFromSocketMessage(message));
    socket.send(JSON.stringify(answer));
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    socket.close(code, reason);
  }
}
