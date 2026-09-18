import assert from "node:assert/strict";
import { test } from "node:test";
import type { DecisionResponse } from "../../backend/src/jev.ts";
import {
  buildRequest,
  chunk,
  JevClient,
  MAX_OPTIONS_PER_QUESTION,
  optionId,
  parseOptionId,
  pickBest,
} from "../../backend/src/jev.ts";
import { emptyBoard, legalMoves } from "../../shared/src/index.ts";

test("optionId round trips", () => {
  const move = { row: 0, col: 2, value: 4 };
  assert.equal(optionId(move), "row_1_col_3_value_4");
  assert.deepEqual(parseOptionId("row_1_col_3_value_4"), move);
  assert.equal(parseOptionId("row_10_col_3_value_4"), null);
});

test("buildRequest splits options into batches of at most 255", () => {
  const board = emptyBoard();
  const moves = legalMoves(board);
  assert.equal(moves.length, 729);
  const request = buildRequest("m", board, moves);
  const questions = Object.values(request.questions);
  assert.equal(questions.length, Math.ceil(729 / MAX_OPTIONS_PER_QUESTION));
  for (const question of questions) {
    assert.ok(Object.keys(question.criteria).length <= MAX_OPTIONS_PER_QUESTION);
  }
  assert.equal(request.state.rows.length, 9);
  assert.equal(request.state.rows[0], ". . . . . . . . .");
});

test("chunk keeps every element once", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test("pickBest takes the highest probability across batches and ignores unknown ids", () => {
  const offered = [
    { row: 0, col: 0, value: 1 },
    { row: 0, col: 0, value: 2 },
    { row: 1, col: 1, value: 3 },
  ];
  const response: DecisionResponse = {
    model: "m",
    answers: {
      move_batch_1: {
        type: "choice",
        choice: "row_1_col_1_value_1",
        probabilities: { row_1_col_1_value_1: 0.6, row_1_col_1_value_2: 0.4 },
        confidence: 0.2,
      },
      move_batch_2: {
        type: "choice",
        choice: "row_9_col_9_value_9",
        probabilities: { row_9_col_9_value_9: 0.9, row_2_col_2_value_3: 0.7 },
        confidence: 0.5,
      },
    },
  };
  const best = pickBest(response, offered);
  assert.deepEqual(best?.move, { row: 1, col: 1, value: 3 });
  assert.equal(best?.probability, 0.7);
  assert.equal(best?.confidence, 0.5);
  assert.equal(best?.questions_asked, 2);
});

test("JevClient sends the request and maps the answer", async () => {
  const board = emptyBoard();
  const moves = [{ row: 0, col: 0, value: 5 }];
  const seen: Array<{ url: string; auth: string | null; body: { model: string } }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as { model: string },
    });
    const body: DecisionResponse = {
      model: "m",
      answers: {
        move_batch_1: {
          type: "choice",
          choice: "row_1_col_1_value_5",
          probabilities: { row_1_col_1_value_5: 1 },
          confidence: 1,
        },
      },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const client = new JevClient({ apiKey: "k", url: "https://example.test/decisions", model: "m", fetchImpl });
  const decision = await client.decide(board, moves);
  assert.deepEqual(decision?.move, moves[0]);
  assert.equal(seen[0]?.url, "https://example.test/decisions");
  assert.equal(seen[0]?.auth, "Bearer k");
  assert.equal(seen[0]?.body.model, "m");
});
