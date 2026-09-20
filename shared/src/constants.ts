// region: grid
export const BOX_SIZE = 3;
export const GRID_SIZE = BOX_SIZE * BOX_SIZE;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const EMPTY = 0;
export const MIN_VALUE = 1;
export const MAX_VALUE = GRID_SIZE;
// endregion: grid

// region: game
/** Wrong placements the model may make before the game is lost. */
export const MAX_MISTAKES = 3;
/** Cells left empty by the generator. Around 45 is a medium puzzle. */
export const DEFAULT_EMPTY_CELLS = 45;
// endregion: game

// region: protocol
export const WS_PATH = "/ws";
export const HEALTH_PATH = "/healthz";
export const HEALTH_BODY = "ok";
export const SUDOKU_PATH = "/";
export const CHESS_PATH = "/chess";
// endregion: protocol

// region: chess
/** Jev choice questions for chess stay at or under this many options. */
export const MAX_CHESS_OPTIONS = 150;
/** Illegal or unusable Jev picks are dropped and the same position is asked this many extra times. */
export const CHESS_ILLEGAL_REROLLS = 1;
export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const CHESS_TURN = {
  white: "w",
  black: "b",
} as const;
export const SAN_CHECK_MARK = "+";
export const SAN_MATE_MARK = "#";
export const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;
export const CHESS_OPTION_ID_PREFIX = "uci_";
export const CHESS_FINISH_REASON = {
  checkmate: "checkmate",
  stalemate: "stalemate",
  draw: "draw",
  noLegalMove: "no legal move is left",
} as const;
export const CHESS_WINS_LABEL = "wins";
export const CHESS_ERROR = {
  invalidFen: "fen is invalid",
  illegalAfterReroll: "Jev returned no legal move after one re-roll",
} as const;
// endregion: chess
