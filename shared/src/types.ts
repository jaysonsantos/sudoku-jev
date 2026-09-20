/** A 9x9 grid. `EMPTY` marks a cell with no value. Row and column indexes are zero based. */
export type Board = number[][];

/** A placement. `row` and `col` are zero based, `value` is 1..9. */
export interface Move {
  row: number;
  col: number;
  value: number;
}

export const GAME_STATUS = {
  playing: "playing",
  won: "won",
  lost: "lost",
  draw: "draw",
} as const;
export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

export const GAME_KIND = {
  sudoku: "sudoku",
  chess: "chess",
} as const;
export type GameKind = (typeof GAME_KIND)[keyof typeof GAME_KIND];

export const CHESS_COLOR = {
  white: "white",
  black: "black",
} as const;
export type ChessColor = (typeof CHESS_COLOR)[keyof typeof CHESS_COLOR];

export const MESSAGE_TYPE = {
  state: "state",
  decision: "decision",
  finished: "finished",
  error: "error",
} as const;

/** Client to server: the current game after every change. */
export interface StateMessage {
  type: typeof MESSAGE_TYPE.state;
  game_id: string;
  board: Board;
  /** Moves the model tried that were wrong. The server never offers them again. */
  rejected: Move[];
  mistakes: number;
  status: GameStatus;
}

/** Server to client: the move the model chose. */
export interface DecisionMessage {
  type: typeof MESSAGE_TYPE.decision;
  game_id: string;
  move: Move;
  /** Probability the model gave to the chosen option inside its question. */
  probability: number;
  /** Confidence of the question that produced the chosen option, 0 to 1. */
  confidence: number;
  options_considered: number;
  questions_asked: number;
  latency_ms: number;
}

/** Server to client: the game is over or has no legal move. Nothing else follows. */
export interface FinishedMessage {
  type: typeof MESSAGE_TYPE.finished;
  game_id: string;
  status: GameStatus;
  reason: string;
}

export interface ErrorMessage {
  type: typeof MESSAGE_TYPE.error;
  game_id: string | null;
  message: string;
}

/** A chess half-move in UCI plus SAN, so the board and the log can both render it. */
export interface ChessMove {
  uci: string;
  san: string;
  from: string;
  to: string;
}

/** Client to server: the current chess position. The server never stores a game. */
export interface ChessStateMessage {
  type: typeof MESSAGE_TYPE.state;
  game: typeof GAME_KIND.chess;
  game_id: string;
  fen: string;
  /** UCI strings the model already tried that were illegal. The server never offers them again. */
  rejected: string[];
  status: GameStatus;
}

/** Server to client: the chess move the model chose, after a legality check. */
export interface ChessDecisionMessage {
  type: typeof MESSAGE_TYPE.decision;
  game: typeof GAME_KIND.chess;
  game_id: string;
  move: ChessMove;
  probability: number;
  confidence: number;
  options_considered: number;
  questions_asked: number;
  latency_ms: number;
  /** `0` on the first legal pick. `1` when the first pick was illegal and the re-roll succeeded. */
  rerolls: number;
}

export type ClientMessage = StateMessage | ChessStateMessage;
export type ServerMessage = DecisionMessage | ChessDecisionMessage | FinishedMessage | ErrorMessage;

export function isChessStateMessage(message: ClientMessage): message is ChessStateMessage {
  return "game" in message && message.game === GAME_KIND.chess;
}

export function isChessDecisionMessage(message: ServerMessage): message is ChessDecisionMessage {
  return message.type === MESSAGE_TYPE.decision && "game" in message && message.game === GAME_KIND.chess;
}
