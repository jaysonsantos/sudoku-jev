import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyUci,
  CHESS_CLOCK_MS,
  CHESS_COLOR,
  CHESS_FINISH_REASON,
  CHESS_PATH,
  chessOutcome,
  formatChessClock,
  GAME_STATUS,
  isChessPath,
  isLegalUci,
  isValidFen,
  legalChessMoves,
  MAX_CHESS_OPTIONS,
  MS_PER_SECOND,
  offeredChessMoves,
  parseUci,
  SECONDS_PER_MINUTE,
  STARTING_FEN,
  sideToMove,
  startingClocks,
  tickSideClock,
  timeoutOutcome,
} from "../../shared/src/index.ts";

const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const SCHOLARS_MATE = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
const MANY_MOVES_FEN = "R6R/3Q4/1Q4Q1/4Q3/2Q4Q/Q4Q2/pp1Q4/kBNN1KB1 w - - 0 1";

test("parseUci reads quiet moves and promotions", () => {
  assert.deepEqual(parseUci("e2e4"), { from: "e2", to: "e4", promotion: undefined });
  assert.deepEqual(parseUci("e7e8q"), { from: "e7", to: "e8", promotion: "q" });
  assert.equal(parseUci("e2e"), null);
  assert.equal(parseUci("zz99"), null);
});

test("starting position has twenty legal moves for white", () => {
  const moves = legalChessMoves(STARTING_FEN);
  assert.equal(moves.length, 20);
  assert.equal(sideToMove(STARTING_FEN), CHESS_COLOR.white);
  assert.ok(moves.some((move) => move.uci === "e2e4"));
});

test("applyUci and isLegalUci accept e2e4 and reject an illegal jump", () => {
  const applied = applyUci(STARTING_FEN, "e2e4");
  assert.equal(applied?.fen, AFTER_E4);
  assert.equal(applied?.san, "e4");
  assert.equal(applied?.color, CHESS_COLOR.white);
  assert.equal(isLegalUci(STARTING_FEN, "e2e4"), true);
  assert.equal(isLegalUci(STARTING_FEN, "e2e5"), false);
  assert.equal(isValidFen("not-a-fen"), false);
});

test("offeredChessMoves drops rejected UCIs and never exceeds 150", () => {
  const withoutE4 = offeredChessMoves(STARTING_FEN, ["e2e4"]);
  assert.equal(withoutE4.length, 19);
  assert.ok(!withoutE4.some((move) => move.uci === "e2e4"));

  const many = legalChessMoves(MANY_MOVES_FEN);
  assert.ok(many.length > MAX_CHESS_OPTIONS);
  const offered = offeredChessMoves(MANY_MOVES_FEN, []);
  assert.equal(offered.length, MAX_CHESS_OPTIONS);
  const ucis = offered.map((move) => move.uci);
  assert.deepEqual(
    ucis,
    [...ucis].sort((left, right) => left.localeCompare(right)),
  );
});

test("chessOutcome reports checkmate", () => {
  const outcome = chessOutcome(SCHOLARS_MATE);
  assert.equal(outcome?.status, GAME_STATUS.won);
  assert.match(outcome?.reason ?? "", /checkmate/);
  assert.match(outcome?.reason ?? "", /white/);
});

test("isChessPath matches /chess and a trailing slash", () => {
  assert.equal(isChessPath(CHESS_PATH), true);
  assert.equal(isChessPath(`${CHESS_PATH}/`), true);
  assert.equal(isChessPath("/"), false);
});

test("formatChessClock and tickSideClock count down one side", () => {
  const clocks = startingClocks();
  assert.equal(clocks.white, CHESS_CLOCK_MS);
  assert.equal(formatChessClock(0), "00:00");
  assert.equal(formatChessClock(MS_PER_SECOND), "00:01");
  assert.equal(formatChessClock(MS_PER_SECOND * SECONDS_PER_MINUTE + MS_PER_SECOND), "01:01");
  const ticked = tickSideClock(clocks, CHESS_COLOR.white, MS_PER_SECOND);
  assert.equal(ticked.clocks.white, CHESS_CLOCK_MS - MS_PER_SECOND);
  assert.equal(ticked.clocks.black, CHESS_CLOCK_MS);
  assert.equal(ticked.flagged, false);
  const flagged = tickSideClock(clocks, CHESS_COLOR.white, CHESS_CLOCK_MS);
  assert.equal(flagged.flagged, true);
  assert.equal(flagged.clocks.white, 0);
  const outcome = timeoutOutcome(CHESS_COLOR.white);
  assert.equal(outcome.status, GAME_STATUS.won);
  assert.match(outcome.reason, new RegExp(CHESS_FINISH_REASON.timeout));
  assert.match(outcome.reason, /black/);
});
