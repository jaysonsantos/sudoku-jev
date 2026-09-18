import { BOX_SIZE, CELL_COUNT, EMPTY, GRID_SIZE, MAX_VALUE, MIN_VALUE } from "./constants.ts";
import type { Board, Move } from "./types.ts";

// region: helpers
export function emptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array<number>(GRID_SIZE).fill(EMPTY));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function boxStart(index: number): number {
  return index - (index % BOX_SIZE);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

const ALL_VALUES = Array.from({ length: MAX_VALUE - MIN_VALUE + 1 }, (_, i) => MIN_VALUE + i);
// endregion: helpers

// region: validation
export function isValidBoardShape(board: unknown): board is Board {
  if (!Array.isArray(board) || board.length !== GRID_SIZE) {
    return false;
  }
  return board.every(
    (row) =>
      Array.isArray(row) &&
      row.length === GRID_SIZE &&
      row.every((cell) => Number.isInteger(cell) && cell >= EMPTY && cell <= MAX_VALUE),
  );
}

/** True when `value` at (row, col) breaks no row, column, or box rule. The cell itself is ignored. */
export function isAllowed(board: Board, move: Move): boolean {
  const { row, col, value } = move;
  for (let i = 0; i < GRID_SIZE; i += 1) {
    if (i !== col && board[row]?.[i] === value) {
      return false;
    }
    if (i !== row && board[i]?.[col] === value) {
      return false;
    }
  }
  const r0 = boxStart(row);
  const c0 = boxStart(col);
  for (let r = r0; r < r0 + BOX_SIZE; r += 1) {
    for (let c = c0; c < c0 + BOX_SIZE; c += 1) {
      if ((r !== row || c !== col) && board[r]?.[c] === value) {
        return false;
      }
    }
  }
  return true;
}

/** Values that fit in one empty cell. Empty array when the cell is filled. */
export function candidatesFor(board: Board, row: number, col: number): number[] {
  if (board[row]?.[col] !== EMPTY) {
    return [];
  }
  return ALL_VALUES.filter((value) => isAllowed(board, { row, col, value }));
}

/** Every legal placement on the board, in reading order. */
export function legalMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      for (const value of candidatesFor(board, row, col)) {
        moves.push({ row, col, value });
      }
    }
  }
  return moves;
}

export function emptyCells(board: Board): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (board[row]?.[col] === EMPTY) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
}

export function isComplete(board: Board): boolean {
  return emptyCells(board).length === 0;
}

export function sameMove(a: Move, b: Move): boolean {
  return a.row === b.row && a.col === b.col && a.value === b.value;
}
// endregion: validation

// region: solver
/**
 * Counts solutions up to `limit` with backtracking. Fills `board` in place while it
 * searches and restores it before it returns.
 */
export function countSolutions(board: Board, limit: number): number {
  const cells = emptyCells(board);
  let found = 0;

  const step = (index: number): void => {
    if (found >= limit) {
      return;
    }
    const cell = cells[index];
    if (cell === undefined) {
      found += 1;
      return;
    }
    const [row, col] = cell;
    for (const value of ALL_VALUES) {
      if (isAllowed(board, { row, col, value })) {
        (board[row] as number[])[col] = value;
        step(index + 1);
        (board[row] as number[])[col] = EMPTY;
      }
    }
  };

  step(0);
  return found;
}

export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(cloneBoard(board), 2) === 1;
}
// endregion: solver

// region: generator
/** A full valid grid, filled by randomized backtracking. */
export function generateSolution(random: () => number = Math.random): Board {
  const board = emptyBoard();
  const fill = (index: number): boolean => {
    if (index === CELL_COUNT) {
      return true;
    }
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    for (const value of shuffle(ALL_VALUES, random)) {
      if (isAllowed(board, { row, col, value })) {
        (board[row] as number[])[col] = value;
        if (fill(index + 1)) {
          return true;
        }
        (board[row] as number[])[col] = EMPTY;
      }
    }
    return false;
  };
  fill(0);
  return board;
}

export interface Puzzle {
  puzzle: Board;
  solution: Board;
}

/**
 * Removes up to `emptyCells` values from a fresh solution while the puzzle keeps
 * exactly one solution. Fewer cells are removed when uniqueness blocks it.
 */
export function generatePuzzle(emptyCells: number, random: () => number = Math.random): Puzzle {
  const solution = generateSolution(random);
  const puzzle = cloneBoard(solution);
  const order = shuffle(
    Array.from({ length: CELL_COUNT }, (_, i) => i),
    random,
  );
  let removed = 0;
  for (const index of order) {
    if (removed >= emptyCells) {
      break;
    }
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    const kept = puzzle[row]?.[col] as number;
    (puzzle[row] as number[])[col] = EMPTY;
    if (hasUniqueSolution(puzzle)) {
      removed += 1;
    } else {
      (puzzle[row] as number[])[col] = kept;
    }
  }
  return { puzzle, solution };
}
// endregion: generator
