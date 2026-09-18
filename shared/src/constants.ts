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
// endregion: protocol
