import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyChessDecision,
  applyOrRejectChessDecision,
  chessAskKey,
  newChessGame,
  rejectChessMove,
  tickChessGame,
  toChessStateMessage,
} from "../../frontend/src/chess/chessGame.ts";
import { STEP_DELAY_MS } from "../../frontend/src/constants.ts";
import { CHESS_CLOCK_TICK_MS, GAME_STATUS, STARTING_FEN } from "../../shared/src/index.ts";

const E2E4 = { uci: "e2e4", san: "e4", from: "e2", to: "e4" } as const;
const BLACK_QUEEN_TO_E7 = { uci: "d8e7", san: "Qe7+", from: "d8", to: "e7" } as const;

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

test("an illegal pick leaves the FEN unchanged and joins rejected", () => {
  const game = newChessGame();
  const next = applyOrRejectChessDecision(game, BLACK_QUEEN_TO_E7);
  assert.equal(next.fen, STARTING_FEN);
  assert.deepEqual(next.rejected, [BLACK_QUEEN_TO_E7.uci]);
  assert.equal(next.lastMove, null);
  assert.notEqual(chessAskKey(next), chessAskKey(game));
  const state = toChessStateMessage(next);
  assert.deepEqual(state.rejected, [BLACK_QUEEN_TO_E7.uci]);
  assert.equal(state.fen, STARTING_FEN);
  assert.equal(state.status, GAME_STATUS.playing);
});

test("a second copy of the same illegal pick does not grow rejected", () => {
  const game = rejectChessMove(newChessGame(), BLACK_QUEEN_TO_E7.uci);
  const next = applyOrRejectChessDecision(game, BLACK_QUEEN_TO_E7);
  assert.equal(next.fen, STARTING_FEN);
  assert.deepEqual(next.rejected, [BLACK_QUEEN_TO_E7.uci]);
  assert.equal(chessAskKey(next), chessAskKey(game));
});

test("a legal pick after a reject applies and clears rejected", () => {
  const game = applyOrRejectChessDecision(newChessGame(), BLACK_QUEEN_TO_E7);
  const next = applyOrRejectChessDecision(game, E2E4);
  assert.notEqual(next.fen, game.fen);
  assert.deepEqual(next.rejected, []);
  assert.equal(next.lastMove?.uci, E2E4.uci);
  assert.equal(applyChessDecision(game, BLACK_QUEEN_TO_E7).fen, game.fen);
});
