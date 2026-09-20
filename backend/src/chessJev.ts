import type { ChessMove, ChessMoveOption } from "../../shared/src/index.ts";
import { chessOptionId, GAME_KIND, parseChessOptionId, sideToMove } from "../../shared/src/index.ts";
import type { ChoiceQuestion, DecisionRequest, DecisionResponse } from "./jev.ts";

// region: request
export const CHESS_QUESTION_ID = "move_batch_1";
export const CHESS_GOAL = "Play the strongest legal chess move for the side to move. Only use a listed option.";
export const CHESS_INSTRUCTIONS =
  "Which legal chess move should the side to move play? Prefer checks, captures, and developing moves. Pick only an option id from this list.";

export interface ChessMoveCriteria {
  uci: string;
  san: string;
  from: string;
  to: string;
  piece: string;
  capture: boolean;
  check: boolean;
  promotion: string | null;
}

export interface ChessBoardState {
  game: typeof GAME_KIND.chess;
  goal: string;
  fen: string;
  side_to_move: string;
  player_color: string;
  legal_move_count: number;
}

export interface ChessJevDecision {
  move: ChessMove;
  probability: number;
  confidence: number;
  options_considered: number;
  questions_asked: number;
}

export function chessToState(fen: string, legalMoveCount: number): ChessBoardState {
  const color = sideToMove(fen);
  return {
    game: GAME_KIND.chess,
    goal: CHESS_GOAL,
    fen,
    side_to_move: color,
    player_color: color,
    legal_move_count: legalMoveCount,
  };
}

export function buildChessRequest(model: string, fen: string, moves: ChessMoveOption[]): DecisionRequest {
  const criteria: Record<string, ChessMoveCriteria> = {};
  for (const move of moves) {
    criteria[chessOptionId(move.uci)] = {
      uci: move.uci,
      san: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece,
      capture: move.capture,
      check: move.check,
      promotion: move.promotion,
    };
  }
  const questions: Record<string, ChoiceQuestion> = {
    [CHESS_QUESTION_ID]: { type: "choice", instructions: CHESS_INSTRUCTIONS, criteria },
  };
  return { model, state: chessToState(fen, moves.length), questions };
}

/** Picks the offered option with the highest probability. Unknown ids are ignored. */
export function pickBestChess(response: DecisionResponse, offered: ChessMoveOption[]): ChessJevDecision | null {
  const byId = new Map(offered.map((move) => [chessOptionId(move.uci), move]));
  let best: ChessJevDecision | null = null;
  const questions = Object.values(response.answers);
  for (const answer of questions) {
    if (answer.type !== "choice") {
      continue;
    }
    for (const [id, probability] of Object.entries(answer.probabilities)) {
      const uci = parseChessOptionId(id);
      const move = uci === null ? undefined : byId.get(id);
      if (uci === null || move === undefined) {
        continue;
      }
      if (best === null || probability > best.probability) {
        best = {
          move: { uci: move.uci, san: move.san, from: move.from, to: move.to },
          probability,
          confidence: answer.confidence,
          options_considered: offered.length,
          questions_asked: questions.length,
        };
      }
    }
  }
  return best;
}
// endregion: request
