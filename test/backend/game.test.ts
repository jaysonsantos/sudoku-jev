import assert from "node:assert/strict";
import { test } from "node:test";
import { offeredMoves, parseStateMessage } from "../../backend/src/game.ts";
import type { StateMessage } from "../../shared/src/index.ts";
import { emptyBoard, GAME_STATUS, MESSAGE_TYPE } from "../../shared/src/index.ts";

function state(): StateMessage {
  return {
    type: MESSAGE_TYPE.state,
    game_id: "g",
    board: emptyBoard(),
    rejected: [{ row: 0, col: 0, value: 1 }],
    mistakes: 1,
    status: GAME_STATUS.playing,
  };
}

test("parseStateMessage accepts a valid state and rejects garbage", () => {
  const parsed = parseStateMessage(JSON.stringify(state()));
  assert.equal(parsed.game_id, "g");
  assert.throws(() => parseStateMessage("nope"), /not JSON/);
  assert.throws(() => parseStateMessage(JSON.stringify({ type: "x" })), /unexpected message type/);
  assert.throws(() => parseStateMessage(JSON.stringify({ ...state(), board: [] })), /board must be/);
});

test("offeredMoves drops rejected moves", () => {
  const moves = offeredMoves(state());
  assert.equal(moves.length, 728);
  assert.ok(!moves.some((m) => m.row === 0 && m.col === 0 && m.value === 1));
});
