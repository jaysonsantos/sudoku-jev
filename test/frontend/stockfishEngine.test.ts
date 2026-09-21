import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBestMove } from "../../frontend/src/chess/stockfishUci.ts";

test("parseBestMove reads a quiet move and a promotion", () => {
  assert.equal(parseBestMove("bestmove e2e4"), "e2e4");
  assert.equal(parseBestMove("bestmove e2e4 ponder e7e5"), "e2e4");
  assert.equal(parseBestMove("bestmove e7e8q"), "e7e8q");
});

test("parseBestMove rejects none, info, and garbage", () => {
  assert.equal(parseBestMove("bestmove (none)"), null);
  assert.equal(parseBestMove("info depth 12"), null);
  assert.equal(parseBestMove("bestmove zz99"), null);
  assert.equal(parseBestMove(""), null);
});
