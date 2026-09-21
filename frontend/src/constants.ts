/** Delay between a received decision and the next state report, so the board is readable. */
export const STEP_DELAY_MS = 400;
/** Wait before the websocket reconnects after a close. */
export const RECONNECT_DELAY_MS = 1500;
/** Log lines kept on screen. */
export const MAX_LOG_LINES = 200;
export const PERCENT = 100;
export const CHESS_TITLE = "Chess: Jev vs Stockfish";
export const CHESS_PIECE_THEME = "/chesspieces/wikipedia/{piece}.png";
export const CHESSBOARD_HIGHLIGHT_FROM = "highlight1-32417";
export const CHESSBOARD_HIGHLIGHT_TO = "highlight2-9c5d2";
export const CHESS_PLAYER = {
  jev: "jev",
  stockfish: "stockfish",
} as const;
export type ChessPlayer = (typeof CHESS_PLAYER)[keyof typeof CHESS_PLAYER];
/** `random() < split` assigns Jev to white. */
export const CHESS_PLAYER_PAIRING_SPLIT = 0.5;
export const PLAYER_LABEL = {
  jev: "Jev",
  stockfish: "Stockfish",
} as const;
export const PLAYER_COLOR_SEPARATOR = " · ";
export const PAIRING_VS = " vs ";
export const TURN_TO_MOVE = "to move";
export const TURN_WAITING = "waiting";
export const EMPTY_STATE_VALUE = "—";
export const PLAY_MATCH_LABEL = "Jev vs Stockfish";
export const ASKS_JEV_SUFFIX = " asks Jev";
export const ASKS_STOCKFISH_SUFFIX = " asks Stockfish";
export const SHARED_BOARD_LABEL = "shared board";
export const SHARED_FEN_LABEL = "fen";
export const SIDE_TO_MOVE_LABEL = "side_to_move";
export const STOCKFISH_STATUS = {
  loading: "loading",
  ready: "ready",
  error: "error",
} as const;
export type StockfishStatus = (typeof STOCKFISH_STATUS)[keyof typeof STOCKFISH_STATUS];
export const STOCKFISH_STATUS_PREFIX = "stockfish: ";
/** npm package published from https://github.com/nmrugg/stockfish.js */
export const STOCKFISH_PACKAGE = "stockfish";
export const STOCKFISH_ASSET_DIR = "stockfish";
export const STOCKFISH_JS_FILE = "stockfish-19-lite-single.js";
export const STOCKFISH_WASM_FILE = "stockfish-19-lite-single.wasm";
export const STOCKFISH_WORKER_PATH = `/${STOCKFISH_ASSET_DIR}/${STOCKFISH_JS_FILE}`;
export const STOCKFISH_GO_DEPTH = 12;
export const STOCKFISH_ILLEGAL_RETRIES = 2;
export const STOCKFISH_MOVE_TIMEOUT_MS = 20_000;
export const STOCKFISH_LOAD_TIMEOUT_MS = 30_000;
export const STOCKFISH_LOG_TAG = "stockfish";
export const STOCKFISH_ERROR = {
  load: "Stockfish failed to load",
  timeout: "Stockfish timed out",
  illegalAfterRetry: "Stockfish returned no legal move after retries",
} as const;
export const CHESS_CLIENT_ERROR = {
  sudokuDecision: "server sent a sudoku decision on /chess",
  jevOnStockfishTurn: "ignored a Jev decision on Stockfish's turn",
} as const;
export const REJECTED_MOVE_PREFIX = "rejected illegal move ";
export const PAUSED_LABEL = "paused";
export const NEW_GAME_PREFIX = "new game: ";
export const SERVER_PREFIX = "server: ";
export const MATCH_COST_LABEL = "match cost";
export const PUZZLE_COST_LABEL = "puzzle cost";
export const COST_LABEL_SEPARATOR = ": ";
export const COST_CURRENCY = "$";
export const COST_DECIMALS = 4;
export const COST_SMALL_DECIMALS = 6;
export const COST_SMALL_THRESHOLD = 0.0001;
export const ZERO_COST = 0;
export const MISTAKES_LABEL = "mistakes";
export const SUDOKU_BOARD_SECTION_LABEL = "sudoku";
export const SUDOKU_STATE_LABEL = "puzzle state";
export const GITHUB_REPO_LABEL = "GitHub";
export const GITHUB_REPO_URL = "https://github.com/jaysonsantos/sudoku-jev/tree/main";
export const GITHUB_LINK_TARGET = "_blank";
export const GITHUB_LINK_REL = "noreferrer";
export const NAV_ARIA_LABEL = "games";
export const NAV_SUDOKU_LABEL = "Sudoku";
export const NAV_CHESS_LABEL = "Chess";
