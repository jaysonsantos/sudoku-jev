/** Delay between a received decision and the next state report, so the board is readable. */
export const STEP_DELAY_MS = 400;
/** Wait before the websocket reconnects after a close. */
export const RECONNECT_DELAY_MS = 1500;
/** Log lines kept on screen. */
export const MAX_LOG_LINES = 200;
export const PERCENT = 100;
export const CHESS_TITLE = "Chess played by Jev";
export const CHESS_PIECE_THEME = "/chesspieces/wikipedia/{piece}.png";
export const CHESSBOARD_HIGHLIGHT_FROM = "highlight1-32417";
export const CHESSBOARD_HIGHLIGHT_TO = "highlight2-9c5d2";
export const PLAYER_TITLE = {
  white: "Player White",
  black: "Player Black",
} as const;
export const YOU_ARE_PREFIX = "You are ";
export const TURN_YOURS = "your turn";
export const TURN_WAITING = "waiting";
export const EMPTY_STATE_VALUE = "—";
export const PLAY_BOTH_LABEL = "Jev plays both colors";
