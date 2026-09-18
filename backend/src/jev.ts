import type { Board, Move } from "../../shared/src/index.ts";
import { candidatesFor, EMPTY } from "../../shared/src/index.ts";

// region: limits
/** Jev accepts at most this many options in one choice question. */
export const MAX_OPTIONS_PER_QUESTION = 255;
/** Rows of the board that are sent as state. */
export const EMPTY_CELL_SYMBOL = ".";
export const QUESTION_PREFIX = "move_batch_";
export const OPTION_ID_PREFIX = "row_";
const HTTP_TITLE_HEADER = "X-OpenRouter-Title";
const APP_TITLE = "sudoku-jev";
// endregion: limits

// region: request types
export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, MoveCriteria>;
}

/** Structured option description. Jev reads these as the option's meaning. */
export interface MoveCriteria {
  row: number;
  column: number;
  value: number;
  /** Every value that fits in the same cell, so a single-candidate cell is visible. */
  cell_candidates: number[];
}

export interface DecisionRequest {
  model: string;
  state: BoardState;
  questions: Record<string, ChoiceQuestion>;
}

export interface BoardState {
  game: "sudoku";
  goal: string;
  rows: string[];
  empty_cells: number;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface DecisionResponse {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage?: { input_tokens: number; output_tokens: number; cost?: number };
  id?: string;
}

export interface Decision {
  move: Move;
  probability: number;
  confidence: number;
  options_considered: number;
  questions_asked: number;
}
// endregion: request types

// region: option ids
/** `row_1_col_3_value_4`, one based, so the id reads like a sentence. */
export function optionId(move: Move): string {
  return `${OPTION_ID_PREFIX}${move.row + 1}_col_${move.col + 1}_value_${move.value}`;
}

const OPTION_ID_PATTERN = /^row_([1-9])_col_([1-9])_value_([1-9])$/;

export function parseOptionId(id: string): Move | null {
  const match = OPTION_ID_PATTERN.exec(id);
  if (match === null) {
    return null;
  }
  return {
    row: Number(match[1]) - 1,
    col: Number(match[2]) - 1,
    value: Number(match[3]),
  };
}
// endregion: option ids

// region: request building
export function boardToState(board: Board): BoardState {
  const rows = board.map((row) => row.map((cell) => (cell === EMPTY ? EMPTY_CELL_SYMBOL : String(cell))).join(" "));
  const emptyCount = board.flat().filter((cell) => cell === EMPTY).length;
  return {
    game: "sudoku",
    goal: "Fill every empty cell (.) so that each row, each column, and each 3x3 box holds the digits 1 to 9 once.",
    rows,
    empty_cells: emptyCount,
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const INSTRUCTIONS =
  "Which placement is certainly correct for this sudoku? Prefer a cell whose cell_candidates has one value. Otherwise pick the placement that the row, column, and box rules force.";

export function buildRequest(model: string, board: Board, moves: Move[]): DecisionRequest {
  const questions: Record<string, ChoiceQuestion> = {};
  chunk(moves, MAX_OPTIONS_PER_QUESTION).forEach((batch, index) => {
    const criteria: Record<string, MoveCriteria> = {};
    for (const move of batch) {
      criteria[optionId(move)] = {
        row: move.row + 1,
        column: move.col + 1,
        value: move.value,
        cell_candidates: candidatesFor(board, move.row, move.col),
      };
    }
    questions[`${QUESTION_PREFIX}${index + 1}`] = { type: "choice", instructions: INSTRUCTIONS, criteria };
  });
  return { model, state: boardToState(board), questions };
}
// endregion: request building

// region: response handling
/** Picks the option with the highest probability across every batch. */
export function pickBest(response: DecisionResponse, offered: Move[]): Decision | null {
  const offeredIds = new Set(offered.map(optionId));
  let best: Decision | null = null;
  const questions = Object.values(response.answers);
  for (const answer of questions) {
    if (answer.type !== "choice") {
      continue;
    }
    for (const [id, probability] of Object.entries(answer.probabilities)) {
      const move = parseOptionId(id);
      if (move === null || !offeredIds.has(id)) {
        continue;
      }
      if (best === null || probability > best.probability) {
        best = {
          move,
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
// endregion: response handling

// region: client
export class JevError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "JevError";
    this.status = status;
  }
}

export interface JevClientOptions {
  apiKey: string;
  url: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export class JevClient {
  private readonly apiKey: string;
  private readonly url: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: JevClientOptions) {
    this.apiKey = options.apiKey;
    this.url = options.url;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Asks Jev for one move out of `moves`. Returns null when the model picked nothing usable. */
  async decide(board: Board, moves: Move[]): Promise<Decision | null> {
    if (moves.length === 0) {
      return null;
    }
    const request = buildRequest(this.model, board, moves);
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        [HTTP_TITLE_HEADER]: APP_TITLE,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new JevError(`OpenRouter answered ${response.status}: ${text}`, response.status);
    }
    const body = (await response.json()) as DecisionResponse;
    return pickBest(body, moves);
  }
}
// endregion: client
