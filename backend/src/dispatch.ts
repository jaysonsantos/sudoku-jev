import type { ServerMessage } from "../../shared/src/index.ts";
import { GAME_KIND } from "../../shared/src/index.ts";
import { answerChessState, parseChessStateMessage } from "./chessGame.ts";
import { answerState, parseStateMessage } from "./game.ts";
import type { GameClient } from "./jev.ts";

function peekJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data === "object" && data !== null) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function peekGameKind(raw: string): string | undefined {
  const data = peekJsonObject(raw);
  return typeof data?.game === "string" ? data.game : undefined;
}

export function peekGameId(raw: string): string | null {
  const data = peekJsonObject(raw);
  return typeof data?.game_id === "string" && data.game_id.length > 0 ? data.game_id : null;
}

export async function answerClientMessage(client: GameClient, raw: string): Promise<ServerMessage> {
  if (peekGameKind(raw) === GAME_KIND.chess) {
    return answerChessState(client, parseChessStateMessage(raw));
  }
  return answerState(client, parseStateMessage(raw));
}
