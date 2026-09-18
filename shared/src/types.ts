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
} as const;
export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

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

export type ClientMessage = StateMessage;
export type ServerMessage = DecisionMessage | FinishedMessage | ErrorMessage;
