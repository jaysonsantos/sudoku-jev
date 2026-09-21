import assert from "node:assert/strict";
import { test } from "node:test";
import type { Decision, GameClient } from "../../backend/src/jev.ts";
import { LOG_EVENT } from "../../cloudflare/src/constants.ts";
import { answerRawState, respondToSocketText, textFromSocketMessage } from "../../cloudflare/src/handle.ts";
import type { StateMessage } from "../../shared/src/index.ts";
import {
  emptyBoard,
  GAME_KIND,
  GAME_STATUS,
  isChessDecisionMessage,
  MESSAGE_TYPE,
  STARTING_FEN,
} from "../../shared/src/index.ts";

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

function clientWith(decision: Decision | null): GameClient {
  return {
    decide: async () => decision,
    decideChess: async () => {
      throw new Error("sudoku test should not ask chess");
    },
  };
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
  const client: GameClient = {
    decide: async () => {
      throw new Error("openrouter down");
    },
    decideChess: async () => {
      throw new Error("sudoku test should not ask chess");
    },
  };
  const answer = await respondToSocketText(client, JSON.stringify(state()));
  assert.equal(answer.type, MESSAGE_TYPE.error);
  if (answer.type === MESSAGE_TYPE.error) {
    assert.equal(answer.game_id, "g");
    assert.equal(answer.message, "openrouter down");
  }
});

test("respondToSocketText answers a chess state", async () => {
  const client: GameClient = {
    decide: async () => {
      throw new Error("chess test should not ask sudoku");
    },
    decideChess: async () => ({
      decision: {
        move: { uci: "e2e4", san: "e4", from: "e2", to: "e4" },
        probability: 1,
        confidence: 1,
        options_considered: 20,
        questions_asked: 1,
      },
      cost: 0,
    }),
  };
  const answer = await respondToSocketText(
    client,
    JSON.stringify({
      type: MESSAGE_TYPE.state,
      game: GAME_KIND.chess,
      game_id: "c",
      fen: STARTING_FEN,
      rejected: [],
      status: GAME_STATUS.playing,
    }),
  );
  assert.equal(answer.type, MESSAGE_TYPE.decision);
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.game, GAME_KIND.chess);
    assert.equal(answer.move.uci, "e2e4");
  } else {
    assert.fail("expected a chess decision");
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
