import type { Move, ServerMessage, StateMessage } from "../../shared/src/index.ts";
import { GAME_STATUS, isValidBoardShape, legalMoves, MESSAGE_TYPE, sameMove } from "../../shared/src/index.ts";
import type { DecideClient } from "./jev.ts";

// region: parsing
export function parseStateMessage(raw: string): StateMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("message is not JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("message is not an object");
  }
  const message = data as Partial<StateMessage>;
  if (message.type !== MESSAGE_TYPE.state) {
    throw new Error(`unexpected message type "${String(message.type)}"`);
  }
  if (typeof message.game_id !== "string" || message.game_id.length === 0) {
    throw new Error("game_id is missing");
  }
  if (!isValidBoardShape(message.board)) {
    throw new Error("board must be 9 rows of 9 integers from 0 to 9");
  }
  if (!Array.isArray(message.rejected)) {
    throw new Error("rejected must be an array");
  }
  if (typeof message.mistakes !== "number") {
    throw new Error("mistakes must be a number");
  }
  if (!Object.values(GAME_STATUS).includes(message.status as never)) {
    throw new Error("status is invalid");
  }
  return message as StateMessage;
}
// endregion: parsing

// region: decision
/** Legal moves the client has not rejected yet. */
export function offeredMoves(state: StateMessage): Move[] {
  return legalMoves(state.board).filter((move) => !state.rejected.some((rejected) => sameMove(rejected, move)));
}

export async function answerState(client: DecideClient, state: StateMessage): Promise<ServerMessage> {
  if (state.status !== GAME_STATUS.playing) {
    return {
      type: MESSAGE_TYPE.finished,
      game_id: state.game_id,
      status: state.status,
      reason: `game is ${state.status}`,
    };
  }
  const moves = offeredMoves(state);
  if (moves.length === 0) {
    return {
      type: MESSAGE_TYPE.finished,
      game_id: state.game_id,
      status: GAME_STATUS.lost,
      reason: "no legal move is left",
    };
  }
  const started = performance.now();
  const decision = await client.decide(state.board, moves);
  if (decision === null) {
    return {
      type: MESSAGE_TYPE.error,
      game_id: state.game_id,
      message: "the model chose no offered option",
    };
  }
  return {
    type: MESSAGE_TYPE.decision,
    game_id: state.game_id,
    move: decision.move,
    probability: decision.probability,
    confidence: decision.confidence,
    options_considered: decision.options_considered,
    questions_asked: decision.questions_asked,
    latency_ms: Math.round(performance.now() - started),
  };
}
// endregion: decision
