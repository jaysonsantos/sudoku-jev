import assert from "node:assert/strict";
import { test } from "node:test";
import type { DecideClient, Decision } from "../../backend/src/jev.ts";
import { LOG_EVENT } from "../../cloudflare/src/constants.ts";
import { answerRawState, respondToSocketText, textFromSocketMessage } from "../../cloudflare/src/handle.ts";
import type { StateMessage } from "../../shared/src/index.ts";
import { emptyBoard, GAME_STATUS, MESSAGE_TYPE } from "../../shared/src/index.ts";

function state(): StateMessage {
  return {
    type: MESSAGE_TYPE.state,
    game_id: "g",
    board: emptyBoard(),
    rejected: [],
    mistakes: 0,
    status: GAME_STATUS.playing,
  };
}

function clientWith(decision: Decision | null): DecideClient {
  return { decide: async () => decision };
}

test("textFromSocketMessage decodes bytes and passes strings through", () => {
  assert.equal(textFromSocketMessage("hi"), "hi");
  assert.equal(textFromSocketMessage(new TextEncoder().encode("hi").buffer), "hi");
});

test("answerRawState returns a decision from the model", async () => {
  const move = { row: 0, col: 0, value: 2 };
  const answer = await answerRawState(
    clientWith({
      move,
      probability: 1,
      confidence: 1,
      options_considered: 1,
      questions_asked: 1,
    }),
    JSON.stringify(state()),
  );
  assert.equal(answer.type, MESSAGE_TYPE.decision);
  if (answer.type === MESSAGE_TYPE.decision) {
    assert.deepEqual(answer.move, move);
  }
});

test("respondToSocketText turns a bad payload into an error message", async () => {
  const answer = await respondToSocketText(clientWith(null), "nope");
  assert.equal(answer.type, MESSAGE_TYPE.error);
  if (answer.type === MESSAGE_TYPE.error) {
    assert.equal(answer.game_id, null);
    assert.match(answer.message, /not JSON/);
  }
});

test("respondToSocketText keeps game_id when the model fails after parse", async () => {
  const client: DecideClient = {
    decide: async () => {
      throw new Error("openrouter down");
    },
  };
  const answer = await respondToSocketText(client, JSON.stringify(state()));
  assert.equal(answer.type, MESSAGE_TYPE.error);
  if (answer.type === MESSAGE_TYPE.error) {
    assert.equal(answer.game_id, "g");
    assert.equal(answer.message, "openrouter down");
  }
});

test("respondToSocketText logs a decision event", async () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (value: unknown) => {
    lines.push(String(value));
  };
  try {
    const move = { row: 0, col: 0, value: 2 };
    await respondToSocketText(
      clientWith({
        move,
        probability: 1,
        confidence: 1,
        options_considered: 1,
        questions_asked: 1,
      }),
      JSON.stringify(state()),
    );
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0] ?? "") as { event: string; game_id: string };
  assert.equal(payload.event, LOG_EVENT.decision);
  assert.equal(payload.game_id, "g");
});
