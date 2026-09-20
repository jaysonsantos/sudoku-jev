import { Chess, validateFen } from "chess.js";
import {
  CHESS_FINISH_REASON,
  CHESS_OPTION_ID_PREFIX,
  CHESS_PATH,
  CHESS_TURN,
  CHESS_WINS_LABEL,
  MAX_CHESS_OPTIONS,
  SAN_CHECK_MARK,
  SAN_MATE_MARK,
  UCI_PATTERN,
} from "./constants.ts";
import type { ChessColor, ChessMove, GameStatus } from "./types.ts";
import { CHESS_COLOR, GAME_STATUS } from "./types.ts";

export interface ChessMoveOption extends ChessMove {
  piece: string;
  capture: boolean;
  check: boolean;
  promotion: string | null;
}

export interface ParsedUci {
  from: string;
  to: string;
  promotion: string | undefined;
}

export interface AppliedChessMove extends ChessMove {
  fen: string;
  color: ChessColor;
}

export interface ChessOutcome {
  status: GameStatus;
  reason: string;
}

export function isChessPath(pathname: string): boolean {
  return pathname === CHESS_PATH || pathname === `${CHESS_PATH}/`;
}

export function isValidFen(value: unknown): value is string {
  return typeof value === "string" && validateFen(value).ok;
}

export function parseUci(uci: string): ParsedUci | null {
  const match = UCI_PATTERN.exec(uci);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  return {
    from: match[1],
    to: match[2],
    promotion: match[3],
  };
}

export function chessOptionId(uci: string): string {
  return `${CHESS_OPTION_ID_PREFIX}${uci}`;
}

export function parseChessOptionId(id: string): string | null {
  if (!id.startsWith(CHESS_OPTION_ID_PREFIX)) {
    return null;
  }
  const uci = id.slice(CHESS_OPTION_ID_PREFIX.length);
  return parseUci(uci) === null ? null : uci;
}

export function sideToMove(fen: string): ChessColor {
  const chess = new Chess(fen);
  return toColor(chess.turn());
}

function toColor(value: typeof CHESS_TURN.white | typeof CHESS_TURN.black): ChessColor {
  return value === CHESS_TURN.white ? CHESS_COLOR.white : CHESS_COLOR.black;
}

export function legalChessMoves(fen: string): ChessMoveOption[] {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).map((move) => ({
    uci: move.lan,
    san: move.san,
    from: move.from,
    to: move.to,
    piece: move.piece,
    capture: move.isCapture(),
    check: move.san.includes(SAN_CHECK_MARK) || move.san.includes(SAN_MATE_MARK),
    promotion: move.promotion ?? null,
  }));
}

/** Legal moves not in `rejected`, sorted by UCI, then cut to `MAX_CHESS_OPTIONS`. */
export function offeredChessMoves(fen: string, rejected: readonly string[]): ChessMoveOption[] {
  return legalChessMoves(fen)
    .filter((move) => !rejected.includes(move.uci))
    .sort((left, right) => left.uci.localeCompare(right.uci))
    .slice(0, MAX_CHESS_OPTIONS);
}

export function applyUci(fen: string, uci: string): AppliedChessMove | null {
  const parsed = parseUci(uci);
  if (parsed === null || !isValidFen(fen)) {
    return null;
  }
  const chess = new Chess(fen);
  try {
    const move = chess.move({
      from: parsed.from,
      to: parsed.to,
      promotion: parsed.promotion,
    });
    return {
      uci: move.lan,
      san: move.san,
      from: move.from,
      to: move.to,
      fen: chess.fen(),
      color: toColor(move.color),
    };
  } catch {
    return null;
  }
}

export function isLegalUci(fen: string, uci: string): boolean {
  return applyUci(fen, uci) !== null;
}

export function chessOutcome(fen: string): ChessOutcome | null {
  if (!isValidFen(fen)) {
    return null;
  }
  const chess = new Chess(fen);
  if (chess.isCheckmate()) {
    const winner = chess.turn() === CHESS_TURN.white ? CHESS_COLOR.black : CHESS_COLOR.white;
    return { status: GAME_STATUS.won, reason: `${CHESS_FINISH_REASON.checkmate}: ${winner} ${CHESS_WINS_LABEL}` };
  }
  if (chess.isStalemate()) {
    return { status: GAME_STATUS.draw, reason: CHESS_FINISH_REASON.stalemate };
  }
  if (chess.isDraw() || chess.isGameOver()) {
    return { status: GAME_STATUS.draw, reason: CHESS_FINISH_REASON.draw };
  }
  return null;
}
