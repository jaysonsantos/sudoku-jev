import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChessRequest, CHESS_QUESTION_ID, pickBestChess } from "../../backend/src/chessJev.ts";
import type { DecisionResponse } from "../../backend/src/jev.ts";
import { JevClient } from "../../backend/src/jev.ts";
import { GAME_KIND, legalChessMoves, STARTING_FEN } from "../../shared/src/index.ts";

test("buildChessRequest sends one question of legal UCIs and the player color", () => {
  const moves = legalChessMoves(STARTING_FEN);
  const request = buildChessRequest("m", STARTING_FEN, moves);
  const question = request.questions[CHESS_QUESTION_ID];
  assert.ok(question);
  assert.equal(Object.keys(question.criteria).length, moves.length);
  assert.equal((request.state as { game: string }).game, GAME_KIND.chess);
  assert.equal((request.state as { player_color: string }).player_color, "white");
  assert.equal((request.state as { side_to_move: string }).side_to_move, "white");
  assert.ok(Object.keys(question.criteria).every((id) => id.startsWith("uci_")));
});

test("pickBestChess takes the highest probability among offered ids", () => {
  const offered = legalChessMoves(STARTING_FEN).filter((move) => move.uci === "e2e4" || move.uci === "d2d4");
  const response: DecisionResponse = {
    model: "m",
    answers: {
      move_batch_1: {
        type: "choice",
        choice: "uci_a1a1",
        probabilities: { uci_a1a1: 0.9, uci_e2e4: 0.4, uci_d2d4: 0.7 },
        confidence: 0.5,
      },
    },
  };
  const best = pickBestChess(response, offered);
  assert.equal(best?.move.uci, "d2d4");
  assert.equal(best?.probability, 0.7);
  assert.equal(best?.options_considered, offered.length);
});

test("JevClient.decideChess posts a chess request and maps the answer", async () => {
  const moves = legalChessMoves(STARTING_FEN).filter((move) => move.uci === "e2e4");
  const seen: Array<{ url: string; body: { model: string; state: { game: string } } }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as { model: string; state: { game: string } },
    });
    const body: DecisionResponse = {
      model: "m",
      answers: {
        move_batch_1: {
          type: "choice",
          choice: "uci_e2e4",
          probabilities: { uci_e2e4: 1 },
          confidence: 1,
        },
      },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const client = new JevClient({ apiKey: "k", url: "https://example.test/decisions", model: "m", fetchImpl });
  const decision = await client.decideChess(STARTING_FEN, moves);
  assert.equal(decision?.move.uci, "e2e4");
  assert.equal(seen[0]?.body.state.game, GAME_KIND.chess);
});
