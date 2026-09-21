import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChessDecideClient } from "../../backend/src/chessGame.ts";
import { answerChessState, parseChessStateMessage } from "../../backend/src/chessGame.ts";
import type { ChessDecideResult, ChessJevDecision } from "../../backend/src/chessJev.ts";
import { type DecisionResponse, JevClient } from "../../backend/src/jev.ts";
import type { ChessMoveOption, ChessStateMessage } from "../../shared/src/index.ts";
import {
  CHESS_ERROR,
  GAME_KIND,
  GAME_STATUS,
  isChessDecisionMessage,
  MESSAGE_TYPE,
  STARTING_FEN,
} from "../../shared/src/index.ts";

function state(overrides: Partial<ChessStateMessage> = {}): ChessStateMessage {
  return {
    type: MESSAGE_TYPE.state,
    game: GAME_KIND.chess,
    game_id: "g",
    fen: STARTING_FEN,
    rejected: [],
    status: GAME_STATUS.playing,
    ...overrides,
  };
}

function decisionFor(uci: string, san: string, cost = 0): ChessJevDecision {
  return {
    move: { uci, san, from: uci.slice(0, 2), to: uci.slice(2, 4) },
    probability: 0.8,
    confidence: 0.6,
    options_considered: 20,
    questions_asked: 1,
    cost,
  };
}

function resultFor(uci: string, san: string, cost = 0): ChessDecideResult {
  return { decision: decisionFor(uci, san, cost), cost };
}

function emptyResult(cost: number): ChessDecideResult {
  return { decision: null, cost };
}

test("parseChessStateMessage accepts a valid chess state and rejects garbage", () => {
  const parsed = parseChessStateMessage(JSON.stringify(state()));
  assert.equal(parsed.game, GAME_KIND.chess);
  assert.equal(parsed.fen, STARTING_FEN);
  assert.throws(() => parseChessStateMessage("nope"), /not JSON/);
  assert.throws(() => parseChessStateMessage(JSON.stringify({ type: "state", game: "chess" })), /game_id/);
  assert.throws(() => parseChessStateMessage(JSON.stringify(state({ fen: "bad" }))), /fen is invalid/);
});

test("answerChessState maps a legal model choice to a chess decision", async () => {
  const client: ChessDecideClient = {
    decideChess: async () => resultFor("e2e4", "e4", 0.0123),
  };
  const answer = await answerChessState(client, state());
  assert.ok(isChessDecisionMessage(answer));
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.game, GAME_KIND.chess);
    assert.equal(answer.move.uci, "e2e4");
    assert.equal(answer.rerolls, 0);
    assert.equal(answer.cost, 0.0123);
  }
});

test("answerChessState re-rolls a wrong-side pick that was not in the offered set", async () => {
  const seen: string[][] = [];
  const client: ChessDecideClient = {
    decideChess: async (_fen, moves: ChessMoveOption[]) => {
      seen.push(moves.map((move) => move.uci));
      if (seen.length === 1) {
        return resultFor("d8e7", "Qe7+", 0.01);
      }
      return resultFor("e2e4", "e4", 0.02);
    },
  };
  const answer = await answerChessState(client, state());
  assert.ok(isChessDecisionMessage(answer));
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.move.uci, "e2e4");
    assert.equal(answer.rerolls, 1);
    assert.equal(answer.cost, 0.03);
  }
  assert.equal(seen.length, 2);
  assert.ok(!seen[0]?.includes("d8e7"));
  assert.ok(!seen[1]?.includes("d8e7"));
});

test("answerChessState re-rolls once after an illegal pick then returns a legal move", async () => {
  const seen: string[][] = [];
  const client: ChessDecideClient = {
    decideChess: async (_fen, moves: ChessMoveOption[]) => {
      seen.push(moves.map((move) => move.uci));
      if (seen.length === 1) {
        return resultFor("a1a1", "??");
      }
      return resultFor("e2e4", "e4");
    },
  };
  const answer = await answerChessState(client, state());
  assert.ok(isChessDecisionMessage(answer));
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.move.uci, "e2e4");
    assert.equal(answer.rerolls, 1);
  }
  assert.equal(seen.length, 2);
  assert.ok(!seen[1]?.includes("a1a1"));
});

test("answerChessState re-asks through Jev when the choice is a black move for white", async () => {
  const choices: string[] = [];
  const fetchImpl: typeof fetch = async (_input, _init) => {
    const choice = choices.length === 0 ? "uci_d8e7" : "uci_e2e4";
    choices.push(choice);
    const body: DecisionResponse = {
      model: "m",
      answers: {
        move_batch_1: {
          type: "choice",
          choice,
          probabilities: { uci_d8e7: 0.29, uci_e2e4: 0.1 },
          confidence: 0.25,
        },
      },
    };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const client = new JevClient({
    apiKey: "k",
    url: "https://example.test/decisions",
    model: "m",
    fetchImpl,
  });
  const answer = await answerChessState(client, state());
  assert.ok(isChessDecisionMessage(answer));
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.move.uci, "e2e4");
    assert.equal(answer.rerolls, 1);
  }
  assert.deepEqual(choices, ["uci_d8e7", "uci_e2e4"]);
});

test("answerChessState adds cost from a null first pick before the legal retry", async () => {
  const seen: number[] = [];
  const client: ChessDecideClient = {
    decideChess: async () => {
      seen.push(seen.length);
      if (seen.length === 1) {
        return emptyResult(0.01);
      }
      return resultFor("e2e4", "e4", 0.02);
    },
  };
  const answer = await answerChessState(client, state());
  assert.ok(isChessDecisionMessage(answer));
  if (isChessDecisionMessage(answer)) {
    assert.equal(answer.move.uci, "e2e4");
    assert.equal(answer.rerolls, 1);
    assert.equal(answer.cost, 0.03);
  }
  assert.equal(seen.length, 2);
});

test("answerChessState errors after one failed re-roll", async () => {
  const client: ChessDecideClient = {
    decideChess: async () => resultFor("a1a1", "??"),
  };
  const answer = await answerChessState(client, state());
  assert.equal(answer.type, MESSAGE_TYPE.error);
  if (answer.type === MESSAGE_TYPE.error) {
    assert.equal(answer.message, CHESS_ERROR.illegalAfterReroll);
  }
});
