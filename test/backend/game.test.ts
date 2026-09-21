import assert from "node:assert/strict";
import { test } from "node:test";
import { answerState, offeredMoves, parseStateMessage } from "../../backend/src/game.ts";
import type { DecideClient } from "../../backend/src/jev.ts";
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

test("answerState returns finished when the game is not playing", async () => {
  const client: DecideClient = {
    decide: async () => {
      throw new Error("should not ask");
    },
  };
  const answer = await answerState(client, { ...state(), status: GAME_STATUS.won });
  assert.equal(answer.type, MESSAGE_TYPE.finished);
  if (answer.type === MESSAGE_TYPE.finished) {
    assert.match(answer.reason, /won/);
  }
});

test("answerState maps a model choice to a decision", async () => {
  const move = { row: 0, col: 0, value: 2 };
  const client: DecideClient = {
    decide: async () => ({
      move,
      probability: 0.9,
      confidence: 0.8,
      options_considered: 728,
      questions_asked: 3,
      cost: 0.0123,
    }),
  };
  const answer = await answerState(client, state());
  assert.equal(answer.type, MESSAGE_TYPE.decision);
  if (answer.type === MESSAGE_TYPE.decision) {
    assert.deepEqual(answer.move, move);
    assert.equal(answer.probability, 0.9);
    assert.equal(answer.questions_asked, 3);
    assert.equal(answer.cost, 0.0123);
  }
});
