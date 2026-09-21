import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyChessDecision,
  applyOrRejectChessDecision,
  assignChessPlayers,
  chessActorToMove,
  chessAskKey,
  decideStockfishMove,
  formatPlayerColorLabel,
  newChessGame,
  pairingSummary,
  rejectChessMove,
  shouldAskJev,
  shouldAskStockfish,
  tickChessGame,
  toChessStateMessage,
} from "../../frontend/src/chess/chessGame.ts";
import {
  CHESS_PLAYER,
  CHESS_PLAYER_PAIRING_SPLIT,
  PLAYER_COLOR_SEPARATOR,
  PLAYER_LABEL,
  STEP_DELAY_MS,
  STOCKFISH_ILLEGAL_RETRIES,
} from "../../frontend/src/constants.ts";
import { CHESS_CLOCK_TICK_MS, CHESS_COLOR, GAME_KIND, GAME_STATUS, STARTING_FEN } from "../../shared/src/index.ts";

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

test("assignChessPlayers always pairs Jev with Stockfish", () => {
  const jevWhite = assignChessPlayers(() => 0);
  assert.deepEqual(jevWhite, { white: CHESS_PLAYER.jev, black: CHESS_PLAYER.stockfish });
  const stockfishWhite = assignChessPlayers(() => CHESS_PLAYER_PAIRING_SPLIT);
  assert.deepEqual(stockfishWhite, { white: CHESS_PLAYER.stockfish, black: CHESS_PLAYER.jev });
  assert.notEqual(jevWhite.white, jevWhite.black);
  assert.notEqual(stockfishWhite.white, stockfishWhite.black);
});

test("shouldAskJev is false when Stockfish is to move", () => {
  const stockfishWhite = newChessGame(() => 1);
  assert.equal(stockfishWhite.players.white, CHESS_PLAYER.stockfish);
  assert.equal(chessActorToMove(stockfishWhite), CHESS_PLAYER.stockfish);
  assert.equal(shouldAskJev(stockfishWhite), false);
  assert.equal(shouldAskStockfish(stockfishWhite), true);
  const afterWhite = applyChessDecision(stockfishWhite, E2E4);
  assert.equal(chessActorToMove(afterWhite), CHESS_PLAYER.jev);
  assert.equal(shouldAskJev(afterWhite), true);
  assert.equal(shouldAskStockfish(afterWhite), false);
});

test("shouldAskJev is true only for Jev's color", () => {
  const jevWhite = newChessGame(() => 0);
  assert.equal(shouldAskJev(jevWhite), true);
  assert.equal(shouldAskStockfish(jevWhite), false);
  const afterWhite = applyChessDecision(jevWhite, E2E4);
  assert.equal(shouldAskJev(afterWhite), false);
  assert.equal(shouldAskStockfish(afterWhite), true);
});

test("chess state messages stay protocol-shaped and omit players", () => {
  const game = newChessGame(() => 0);
  const state = toChessStateMessage(game);
  assert.deepEqual(Object.keys(state).sort(), ["fen", "game", "game_id", "rejected", "status", "type"]);
  assert.equal(state.game, GAME_KIND.chess);
  assert.equal(state.fen, STARTING_FEN);
});

test("pairing labels name Jev and Stockfish with their colors", () => {
  const game = newChessGame(() => 0);
  assert.equal(
    formatPlayerColorLabel(game.players.white, CHESS_COLOR.white),
    `${PLAYER_LABEL.jev}${PLAYER_COLOR_SEPARATOR}${CHESS_COLOR.white}`,
  );
  assert.match(pairingSummary(game), /Jev/);
  assert.match(pairingSummary(game), /Stockfish/);
});

test("decideStockfishMove applies a legal UCI without asking Jev", async () => {
  const game = newChessGame(() => 1);
  const asked: string[] = [];
  const result = await decideStockfishMove(
    game,
    async (fen) => {
      asked.push(fen);
      return E2E4.uci;
    },
    STOCKFISH_ILLEGAL_RETRIES,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.move.uci, E2E4.uci);
    assert.notEqual(result.game.fen, game.fen);
  }
  assert.deepEqual(asked, [STARTING_FEN]);
  assert.equal(shouldAskJev(game), false);
});

test("decideStockfishMove retries an illegal UCI then applies a legal one", async () => {
  const game = newChessGame(() => 1);
  const answers = [BLACK_QUEEN_TO_E7.uci, E2E4.uci];
  const result = await decideStockfishMove(game, async () => answers.shift() ?? null, STOCKFISH_ILLEGAL_RETRIES);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.move.uci, E2E4.uci);
    assert.deepEqual(result.game.rejected, []);
  }
});

test("decideStockfishMove fails after retries and does not change the FEN", async () => {
  const game = newChessGame(() => 1);
  const result = await decideStockfishMove(game, async () => BLACK_QUEEN_TO_E7.uci, STOCKFISH_ILLEGAL_RETRIES);
  assert.equal(result.ok, false);
  assert.equal(result.game.fen, STARTING_FEN);
  assert.deepEqual(result.game.rejected, [BLACK_QUEEN_TO_E7.uci]);
});
