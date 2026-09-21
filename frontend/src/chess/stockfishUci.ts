import { parseUci } from "../../../shared/src/index.ts";

const UCI_BESTMOVE_PREFIX = "bestmove ";
const UCI_BESTMOVE_NONE = "(none)";
const UCI_TOKEN_SEPARATOR = " ";

export function parseBestMove(line: string): string | null {
  if (!line.startsWith(UCI_BESTMOVE_PREFIX)) {
    return null;
  }
  const token = line.slice(UCI_BESTMOVE_PREFIX.length).trim().split(UCI_TOKEN_SEPARATOR)[0];
  if (token === undefined || token === UCI_BESTMOVE_NONE) {
    return null;
  }
  return parseUci(token) === null ? null : token;
}
