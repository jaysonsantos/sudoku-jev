import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_REPO_URL } from "../../frontend/src/constants.ts";
import { addPuzzleCost, applySudokuDecision, newGame } from "../../frontend/src/game.ts";
import { EMPTY, GAME_STATUS } from "../../shared/src/index.ts";

function firstSolutionMove(game: ReturnType<typeof newGame>): { row: number; col: number; value: number } {
  for (let row = 0; row < game.board.length; row += 1) {
    const line = game.board[row];
    if (line === undefined) {
      continue;
    }
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] === EMPTY) {
        const value = game.solution[row]?.[col];
        if (value !== undefined) {
          return { row, col, value };
        }
      }
    }
  }
  throw new Error("puzzle has no empty cell");
}

test("GitHub nav points at the repository tree on main", () => {
  assert.equal(GITHUB_REPO_URL, "https://github.com/jaysonsantos/sudoku-jev/tree/main");
});

test("addPuzzleCost accumulates Jev USD", () => {
  const game = newGame();
  assert.equal(game.cost, 0);
  const withCost = addPuzzleCost(game, 0.0123);
  assert.equal(withCost.cost, 0.0123);
  assert.equal(addPuzzleCost(withCost, undefined).cost, 0.0123);
});

test("applySudokuDecision adds cost after a correct placement", () => {
  const game = newGame();
  const move = firstSolutionMove(game);
  const next = applySudokuDecision(game, move, 0.01);
  assert.equal(next.board[move.row]?.[move.col], move.value);
  assert.equal(next.lastWasWrong, false);
  assert.equal(next.cost, 0.01);
});

test("applySudokuDecision still adds cost when the puzzle is already over", () => {
  const game = { ...newGame(), status: GAME_STATUS.won };
  const next = applySudokuDecision(game, { row: 0, col: 0, value: 1 }, 0.0123);
  assert.equal(next.status, GAME_STATUS.won);
  assert.equal(next.cost, 0.0123);
});
