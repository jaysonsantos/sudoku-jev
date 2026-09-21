import type { ChessMoveOption, ChessStateMessage, ServerMessage } from "../../shared/src/index.ts";
import {
  CHESS_ERROR,
  CHESS_FINISH_REASON,
  CHESS_ILLEGAL_REROLLS,
  chessOutcome,
  GAME_KIND,
  GAME_STATUS,
  isLegalUci,
  isValidFen,
  MESSAGE_TYPE,
  offeredChessMoves,
} from "../../shared/src/index.ts";
import type { ChessDecideResult } from "./chessJev.ts";

export interface ChessDecideClient {
  decideChess(fen: string, moves: ChessMoveOption[]): Promise<ChessDecideResult>;
}

const ZERO_COST = 0;

// region: parsing
export function parseChessStateMessage(raw: string): ChessStateMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("message is not JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("message is not an object");
  }
  const message = data as Partial<ChessStateMessage>;
  if (message.type !== MESSAGE_TYPE.state) {
    throw new Error(`unexpected message type "${String(message.type)}"`);
  }
  if (message.game !== GAME_KIND.chess) {
    throw new Error("game must be chess");
  }
  if (typeof message.game_id !== "string" || message.game_id.length === 0) {
    throw new Error("game_id is missing");
  }
  if (!isValidFen(message.fen)) {
    throw new Error(CHESS_ERROR.invalidFen);
  }
  if (!Array.isArray(message.rejected) || message.rejected.some((item) => typeof item !== "string")) {
    throw new Error("rejected must be an array of UCI strings");
  }
  if (!Object.values(GAME_STATUS).includes(message.status as never)) {
    throw new Error("status is invalid");
  }
  return message as ChessStateMessage;
}
// endregion: parsing

// region: decision
function isOfferedLegal(fen: string, uci: string, offered: ChessMoveOption[]): boolean {
  return offered.some((move) => move.uci === uci) && isLegalUci(fen, uci);
}

/**
 * Asks Jev for one legal chess move.
 *
 * Policy: offer at most 150 legal UCIs. If Jev's pick is missing or illegal,
 * drop that UCI and ask once more. A second failure is an error.
 */
export async function answerChessState(client: ChessDecideClient, state: ChessStateMessage): Promise<ServerMessage> {
  if (state.status !== GAME_STATUS.playing) {
    return {
      type: MESSAGE_TYPE.finished,
      game_id: state.game_id,
      status: state.status,
      reason: `game is ${state.status}`,
    };
  }
  const over = chessOutcome(state.fen);
  if (over !== null) {
    return {
      type: MESSAGE_TYPE.finished,
      game_id: state.game_id,
      status: over.status,
      reason: over.reason,
    };
  }

  const rejected = [...state.rejected];
  let rerolls = 0;
  let cost = ZERO_COST;
  const started = performance.now();

  while (true) {
    const moves = offeredChessMoves(state.fen, rejected);
    if (moves.length === 0) {
      return {
        type: MESSAGE_TYPE.finished,
        game_id: state.game_id,
        status: GAME_STATUS.lost,
        reason: CHESS_FINISH_REASON.noLegalMove,
      };
    }
    const result = await client.decideChess(state.fen, moves);
    cost += result.cost;
    const decision = result.decision;
    if (decision !== null && isOfferedLegal(state.fen, decision.move.uci, moves)) {
      return {
        type: MESSAGE_TYPE.decision,
        game: GAME_KIND.chess,
        game_id: state.game_id,
        move: decision.move,
        probability: decision.probability,
        confidence: decision.confidence,
        options_considered: decision.options_considered,
        questions_asked: decision.questions_asked,
        latency_ms: Math.round(performance.now() - started),
        rerolls,
        cost,
      };
    }
    if (rerolls >= CHESS_ILLEGAL_REROLLS) {
      return {
        type: MESSAGE_TYPE.error,
        game_id: state.game_id,
        message: CHESS_ERROR.illegalAfterReroll,
      };
    }
    rerolls += 1;
    if (decision !== null) {
      rejected.push(decision.move.uci);
    }
  }
}
// endregion: decision
