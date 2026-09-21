import type { ChessClocks, ChessColor, ChessMove, ChessStateMessage, GameStatus } from "../../../shared/src/index.ts";
import {
  applyUci,
  CHESS_COLOR,
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
import type { ChessPlayer } from "../constants.ts";
import {
  CHESS_PLAYER,
  CHESS_PLAYER_PAIRING_SPLIT,
  PAIRING_VS,
  PLAYER_COLOR_SEPARATOR,
  PLAYER_LABEL,
  ZERO_COST,
} from "../constants.ts";
import { addGameCost } from "../cost.ts";

export { decisionCost, formatMatchCost, formatUsd } from "../cost.ts";

const ASK_KEY_SEPARATOR = "\0";

export interface ChessPlayers {
  white: ChessPlayer;
  black: ChessPlayer;
}

export interface ChessGame {
  id: string;
  fen: string;
  rejected: string[];
  status: GameStatus;
  reason: string | null;
  lastMove: ChessMove | null;
  lastColor: ChessColor | null;
  clocks: ChessClocks;
  players: ChessPlayers;
  /** Accumulated OpenRouter USD cost. Stockfish turns add nothing. */
  cost: number;
}

export function assignChessPlayers(random: () => number = Math.random): ChessPlayers {
  if (random() < CHESS_PLAYER_PAIRING_SPLIT) {
    return { white: CHESS_PLAYER.jev, black: CHESS_PLAYER.stockfish };
  }
  return { white: CHESS_PLAYER.stockfish, black: CHESS_PLAYER.jev };
}

export function formatPlayerColorLabel(player: ChessPlayer, color: ChessColor): string {
  return `${PLAYER_LABEL[player]}${PLAYER_COLOR_SEPARATOR}${color}`;
}

export function pairingSummary(game: ChessGame): string {
  return `${formatPlayerColorLabel(game.players.white, CHESS_COLOR.white)}${PAIRING_VS}${formatPlayerColorLabel(game.players.black, CHESS_COLOR.black)}`;
}

export function newChessGame(random: () => number = Math.random): ChessGame {
  return {
    id: crypto.randomUUID(),
    fen: STARTING_FEN,
    rejected: [],
    status: GAME_STATUS.playing,
    reason: null,
    lastMove: null,
    lastColor: null,
    clocks: startingClocks(),
    players: assignChessPlayers(random),
    cost: ZERO_COST,
  };
}

export function addMatchCost(game: ChessGame, cost: number | undefined): ChessGame {
  return addGameCost(game, cost);
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

export function chessActorToMove(game: ChessGame): ChessPlayer | null {
  if (game.status !== GAME_STATUS.playing) {
    return null;
  }
  return game.players[sideToMove(game.fen)];
}

/** True only when the side to move is Jev. Stockfish turns must not open a /ws ask. */
export function shouldAskJev(game: ChessGame): boolean {
  return chessActorToMove(game) === CHESS_PLAYER.jev;
}

export function shouldAskStockfish(game: ChessGame): boolean {
  return chessActorToMove(game) === CHESS_PLAYER.stockfish;
}

/**
 * Pause cancels a Stockfish search, so waiting can clear.
 * An in-flight Jev /ws ask stays marked so Play cannot bill the same position twice.
 */
export function retainJevAskOnPause(game: ChessGame): boolean {
  return shouldAskJev(game);
}

/** Adds billed Jev cost even when the move is stale or the game is no longer playing. */
export function applyJevDecisionMessage(game: ChessGame, move: ChessMove, cost: number | undefined): ChessGame {
  const next = shouldAskJev(game) ? applyOrRejectChessDecision(game, move) : game;
  return addMatchCost(next, cost);
}

export async function decideStockfishMove(
  game: ChessGame,
  ask: (fen: string) => Promise<string | null>,
  maxRetries: number,
): Promise<{ ok: true; game: ChessGame; move: ChessMove } | { ok: false; game: ChessGame }> {
  let current = game;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const uci = await ask(current.fen);
    if (uci === null) {
      continue;
    }
    const applied = applyUci(current.fen, uci);
    if (applied !== null) {
      return { ok: true, game: applyChessDecision(current, applied), move: applied };
    }
    current = rejectChessMove(current, uci);
  }
  return { ok: false, game: current };
}

/** Position Jev is asked about. Clock fields are omitted so ticks do not reset the ask timer. */
export function chessAskKey(game: ChessGame): string {
  return [game.id, game.fen, game.status, ...game.rejected].join(ASK_KEY_SEPARATOR);
}
