import { answerClientMessage, peekGameId } from "../../backend/src/dispatch.ts";
import type { GameClient } from "../../backend/src/jev.ts";
import type { ChessDecisionMessage, DecisionMessage, ErrorMessage, ServerMessage } from "../../shared/src/index.ts";
import { MESSAGE_TYPE } from "../../shared/src/index.ts";
import { LOG_EVENT } from "./constants.ts";

export { answerClientMessage as answerRawState, peekGameId, peekGameKind } from "../../backend/src/dispatch.ts";

export function textFromSocketMessage(message: string | ArrayBuffer): string {
  return typeof message === "string" ? message : new TextDecoder().decode(message);
}

export function errorFromUnknown(gameId: string | null, error: unknown): ErrorMessage {
  const message = error instanceof Error ? error.message : String(error);
  return { type: MESSAGE_TYPE.error, game_id: gameId, message };
}

export function decisionLog(gameId: string, answer: DecisionMessage | ChessDecisionMessage): Record<string, unknown> {
  return {
    event: LOG_EVENT.decision,
    game_id: gameId,
    move: answer.move,
    probability: answer.probability,
    confidence: answer.confidence,
    options: answer.options_considered,
    latency_ms: answer.latency_ms,
  };
}

export function errorLog(gameId: string | null, message: string): Record<string, unknown> {
  return { event: LOG_EVENT.error, game_id: gameId, message };
}

/** Parses a client payload and answers it. On failure returns an error message. */
export async function respondToSocketText(client: GameClient, raw: string): Promise<ServerMessage> {
  const gameId = peekGameId(raw);
  try {
    const answer = await answerClientMessage(client, raw);
    if (answer.type === MESSAGE_TYPE.decision) {
      console.info(JSON.stringify(decisionLog(answer.game_id, answer)));
    }
    return answer;
  } catch (error) {
    const answer = errorFromUnknown(gameId, error);
    console.error(JSON.stringify(errorLog(gameId, answer.message)));
    return answer;
  }
}
