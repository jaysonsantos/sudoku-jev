import assert from "node:assert/strict";
import { test } from "node:test";
import { applyChessDecision, chessAskKey, newChessGame, tickChessGame } from "../../frontend/src/chess/chessGame.ts";
import { STEP_DELAY_MS } from "../../frontend/src/constants.ts";
import { CHESS_CLOCK_TICK_MS, GAME_STATUS, STARTING_FEN } from "../../shared/src/index.ts";

const E2E4 = { uci: "e2e4", san: "e4", from: "e2", to: "e4" } as const;

test("clock ticks keep the Jev ask key so the send timer is not reset", () => {
  const game = newChessGame();
  const ticked = tickChessGame(game, CHESS_CLOCK_TICK_MS);
  assert.equal(game.fen, STARTING_FEN);
  assert.equal(ticked.status, GAME_STATUS.playing);
  assert.notEqual(ticked.clocks.white, game.clocks.white);
  assert.equal(ticked.fen, game.fen);
  assert.equal(chessAskKey(ticked), chessAskKey(game));
});

test("a legal decision changes the Jev ask key", () => {
  const game = newChessGame();
  const next = applyChessDecision(game, E2E4);
  assert.notEqual(next.fen, game.fen);
  assert.notEqual(chessAskKey(next), chessAskKey(game));
});

test("the ask delay is longer than one clock tick", () => {
  assert.ok(STEP_DELAY_MS > CHESS_CLOCK_TICK_MS);
});
