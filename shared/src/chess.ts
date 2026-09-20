import { Chess, validateFen } from "chess.js";
import {
  CHESS_CLOCK_MS,
  CHESS_FINISH_REASON,
  CHESS_OPTION_ID_PREFIX,
  CHESS_PATH,
  CHESS_TURN,
  CHESS_WINS_LABEL,
  CLOCK_PAD_CHAR,
  CLOCK_PAD_LENGTH,
  CLOCK_SEPARATOR,
  MAX_CHESS_OPTIONS,
  MS_PER_SECOND,
  SAN_CHECK_MARK,
  SAN_MATE_MARK,
  SECONDS_PER_MINUTE,
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

/** UCI is from+to, plus a promotion piece when the move promotes. */
export function uciFromSquares(from: string, to: string, promotion: string | undefined): string {
  return promotion === undefined ? `${from}${to}` : `${from}${to}${promotion}`;
}

export function legalChessMoves(fen: string): ChessMoveOption[] {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).map((move) => ({
    uci: uciFromSquares(move.from, move.to, move.promotion),
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
  const expected = sideToMove(fen);
  const chess = new Chess(fen);
  try {
    const move = chess.move({
      from: parsed.from,
      to: parsed.to,
      promotion: parsed.promotion,
    });
    const color = toColor(move.color);
    if (color !== expected) {
      return null;
    }
    return {
      uci: uciFromSquares(move.from, move.to, move.promotion),
      san: move.san,
      from: move.from,
      to: move.to,
      fen: chess.fen(),
      color,
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

export interface ChessClocks {
  white: number;
  black: number;
}

export function startingClocks(): ChessClocks {
  return { white: CHESS_CLOCK_MS, black: CHESS_CLOCK_MS };
}

export function otherChessColor(color: ChessColor): ChessColor {
  return color === CHESS_COLOR.white ? CHESS_COLOR.black : CHESS_COLOR.white;
}

export function formatChessClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(CLOCK_PAD_LENGTH, CLOCK_PAD_CHAR)}${CLOCK_SEPARATOR}${String(seconds).padStart(CLOCK_PAD_LENGTH, CLOCK_PAD_CHAR)}`;
}

export function tickSideClock(
  clocks: ChessClocks,
  color: ChessColor,
  elapsedMs: number,
): { clocks: ChessClocks; flagged: boolean } {
  const remaining = Math.max(0, clocks[color] - elapsedMs);
  return {
    clocks: { ...clocks, [color]: remaining },
    flagged: remaining === 0,
  };
}

export function timeoutOutcome(flagged: ChessColor): ChessOutcome {
  const winner = otherChessColor(flagged);
  return { status: GAME_STATUS.won, reason: `${CHESS_FINISH_REASON.timeout}: ${winner} ${CHESS_WINS_LABEL}` };
}
