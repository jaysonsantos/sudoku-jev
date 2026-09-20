import type { ChessClocks, ChessColor, ChessMove, ChessStateMessage, GameStatus } from "../../../shared/src/index.ts";
import {
  applyUci,
  chessOutcome,
  GAME_KIND,
  GAME_STATUS,
  MESSAGE_TYPE,
  STARTING_FEN,
  sideToMove,
  startingClocks,
  tickSideClock,
  timeoutOutcome,
} from "../../../shared/src/index.ts";

const ASK_KEY_SEPARATOR = "\0";

export interface ChessGame {
  id: string;
  fen: string;
  rejected: string[];
  status: GameStatus;
  reason: string | null;
  lastMove: ChessMove | null;
  lastColor: ChessColor | null;
  clocks: ChessClocks;
}

export function newChessGame(): ChessGame {
  return {
    id: crypto.randomUUID(),
    fen: STARTING_FEN,
    rejected: [],
    status: GAME_STATUS.playing,
    reason: null,
    lastMove: null,
    lastColor: null,
    clocks: startingClocks(),
  };
}

export function tickChessGame(game: ChessGame, elapsedMs: number): ChessGame {
  if (game.status !== GAME_STATUS.playing) {
    return game;
  }
  const color = sideToMove(game.fen);
  const ticked = tickSideClock(game.clocks, color, elapsedMs);
  if (!ticked.flagged) {
    return { ...game, clocks: ticked.clocks };
  }
  const outcome = timeoutOutcome(color);
  return { ...game, clocks: ticked.clocks, status: outcome.status, reason: outcome.reason };
}

export function applyChessDecision(game: ChessGame, move: ChessMove): ChessGame {
  if (game.status !== GAME_STATUS.playing) {
    return game;
  }
  const applied = applyUci(game.fen, move.uci);
  if (applied === null) {
    return game;
  }
  const outcome = chessOutcome(applied.fen);
  return {
    ...game,
    fen: applied.fen,
    rejected: [],
    lastMove: { uci: applied.uci, san: applied.san, from: applied.from, to: applied.to },
    lastColor: applied.color,
    status: outcome?.status ?? GAME_STATUS.playing,
    reason: outcome?.reason ?? null,
  };
}

/** Records an illegal UCI so the next ask excludes it. Duplicates are ignored. */
export function rejectChessMove(game: ChessGame, uci: string): ChessGame {
  if (game.status !== GAME_STATUS.playing || game.rejected.includes(uci)) {
    return game;
  }
  return { ...game, rejected: [...game.rejected, uci] };
}

export function applyOrRejectChessDecision(game: ChessGame, move: ChessMove): ChessGame {
  const applied = applyChessDecision(game, move);
  if (applied.fen !== game.fen) {
    return applied;
  }
  return rejectChessMove(game, move.uci);
}

export function toChessStateMessage(game: ChessGame): ChessStateMessage {
  return {
    type: MESSAGE_TYPE.state,
    game: GAME_KIND.chess,
    game_id: game.id,
    fen: game.fen,
    rejected: game.rejected,
    status: game.status,
  };
}

export function playerTurn(game: ChessGame, color: ChessColor): boolean {
  return game.status === GAME_STATUS.playing && sideToMove(game.fen) === color;
}

/** Position Jev is asked about. Clock fields are omitted so ticks do not reset the ask timer. */
export function chessAskKey(game: ChessGame): string {
  return [game.id, game.fen, game.status, ...game.rejected].join(ASK_KEY_SEPARATOR);
}
