import type { Board, GameStatus, Move, StateMessage } from "../../shared/src/index.ts";
import {
  cloneBoard,
  DEFAULT_EMPTY_CELLS,
  EMPTY,
  GAME_STATUS,
  generatePuzzle,
  isComplete,
  MAX_MISTAKES,
  MESSAGE_TYPE,
} from "../../shared/src/index.ts";
import { ZERO_COST } from "./constants.ts";
import { addGameCost } from "./cost.ts";

// region: model
export interface Game {
  id: string;
  puzzle: Board;
  board: Board;
  solution: Board;
  rejected: Move[];
  mistakes: number;
  status: GameStatus;
  lastMove: Move | null;
  lastWasWrong: boolean;
  /** Accumulated OpenRouter USD cost for this puzzle. */
  cost: number;
}

export function newGame(): Game {
  const { puzzle, solution } = generatePuzzle(DEFAULT_EMPTY_CELLS);
  return {
    id: crypto.randomUUID(),
    puzzle,
    board: cloneBoard(puzzle),
    solution,
    rejected: [],
    mistakes: 0,
    status: GAME_STATUS.playing,
    lastMove: null,
    lastWasWrong: false,
    cost: ZERO_COST,
  };
}

export function isGiven(game: Game, row: number, col: number): boolean {
  return game.puzzle[row]?.[col] !== EMPTY;
}
// endregion: model

// region: rules
/** Applies the model's move. A wrong value is a mistake and joins `rejected`; a right value fills the cell. */
export function applyMove(game: Game, move: Move): Game {
  if (game.status !== GAME_STATUS.playing) {
    return game;
  }
  const correct = game.solution[move.row]?.[move.col] === move.value;
  if (!correct) {
    const mistakes = game.mistakes + 1;
    return {
      ...game,
      rejected: [...game.rejected, move],
      mistakes,
      status: mistakes >= MAX_MISTAKES ? GAME_STATUS.lost : GAME_STATUS.playing,
      lastMove: move,
      lastWasWrong: true,
    };
  }
  const board = cloneBoard(game.board);
  (board[move.row] as number[])[move.col] = move.value;
  return {
    ...game,
    board,
    status: isComplete(board) ? GAME_STATUS.won : GAME_STATUS.playing,
    lastMove: move,
    lastWasWrong: false,
  };
}

export function addPuzzleCost(game: Game, cost: number | undefined): Game {
  return addGameCost(game, cost);
}

/** Applies the placement and always adds billed Jev cost, even after the puzzle ends. */
export function applySudokuDecision(game: Game, move: Move, cost: number | undefined): Game {
  return addPuzzleCost(applyMove(game, move), cost);
}

export function toStateMessage(game: Game): StateMessage {
  return {
    type: MESSAGE_TYPE.state,
    game_id: game.id,
    board: game.board,
    rejected: game.rejected,
    mistakes: game.mistakes,
    status: game.status,
  };
}
// endregion: rules
