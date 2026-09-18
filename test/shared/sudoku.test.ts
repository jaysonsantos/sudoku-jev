import assert from "node:assert/strict";
import { test } from "node:test";
import {
  candidatesFor,
  countSolutions,
  DEFAULT_EMPTY_CELLS,
  EMPTY,
  emptyCells,
  GRID_SIZE,
  generatePuzzle,
  generateSolution,
  hasUniqueSolution,
  isAllowed,
  isValidBoardShape,
  legalMoves,
} from "../../shared/src/index.ts";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("generateSolution fills a valid grid", () => {
  const board = generateSolution(seeded(1));
  assert.equal(emptyCells(board).length, 0);
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const value = board[row]?.[col] as number;
      assert.ok(isAllowed(board, { row, col, value }));
    }
  }
});

test("generatePuzzle keeps one solution and matches its solution", () => {
  const { puzzle, solution } = generatePuzzle(DEFAULT_EMPTY_CELLS, seeded(7));
  assert.ok(emptyCells(puzzle).length > 0);
  assert.ok(hasUniqueSolution(puzzle));
  assert.equal(countSolutions(puzzle, 2), 1);
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const cell = puzzle[row]?.[col];
      if (cell !== EMPTY) {
        assert.equal(cell, solution[row]?.[col]);
      }
    }
  }
});

test("legalMoves contains the solution value of every empty cell", () => {
  const { puzzle, solution } = generatePuzzle(30, seeded(3));
  const moves = legalMoves(puzzle);
  for (const [row, col] of emptyCells(puzzle)) {
    const value = solution[row]?.[col] as number;
    assert.ok(moves.some((m) => m.row === row && m.col === col && m.value === value));
    assert.ok(candidatesFor(puzzle, row, col).includes(value));
  }
});

test("isValidBoardShape rejects wrong shapes", () => {
  assert.equal(isValidBoardShape([]), false);
  assert.equal(isValidBoardShape(generateSolution(seeded(2))), true);
  const bad = generateSolution(seeded(2));
  (bad[0] as number[])[0] = 10;
  assert.equal(isValidBoardShape(bad), false);
});
