import {
  STOCKFISH_ERROR,
  STOCKFISH_GO_DEPTH,
  STOCKFISH_LOAD_TIMEOUT_MS,
  STOCKFISH_MOVE_TIMEOUT_MS,
  STOCKFISH_WORKER_PATH,
} from "../constants.ts";
import { parseBestMove } from "./stockfishUci.ts";

const UCI_BOOT = "uci";
const UCI_READY = "isready";
const UCI_NEW_GAME = "ucinewgame";
const UCI_STOP = "stop";
const UCI_QUIT = "quit";
const UCI_OK = "uciok";
const UCI_READY_OK = "readyok";
const UCI_POSITION_PREFIX = "position fen ";
const UCI_GO_DEPTH_PREFIX = "go depth ";
const UCI_BESTMOVE_PREFIX = "bestmove ";

export interface StockfishEngine {
  bestMove: (fen: string) => Promise<string | null>;
  stop: () => void;
  terminate: () => void;
}

function lineFromEvent(event: MessageEvent<unknown>): string | null {
  return typeof event.data === "string" ? event.data : null;
}

function waitForLine(worker: Worker, match: (line: string) => boolean, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      reject(new Error(STOCKFISH_ERROR.timeout));
    }, timeoutMs);
    const onMessage = (event: MessageEvent<unknown>): void => {
      const line = lineFromEvent(event);
      if (line === null || !match(line)) {
        return;
      }
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      resolve(line);
    };
    worker.addEventListener("message", onMessage);
  });
}

export function createStockfishEngine(): Promise<StockfishEngine> {
  const worker = new Worker(STOCKFISH_WORKER_PATH);
  let queue: Promise<unknown> = Promise.resolve();

  const run = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const send = (command: string): void => {
    worker.postMessage(command);
  };

  const boot = async (): Promise<void> => {
    send(UCI_BOOT);
    await waitForLine(worker, (line) => line === UCI_OK, STOCKFISH_LOAD_TIMEOUT_MS);
    send(UCI_READY);
    await waitForLine(worker, (line) => line === UCI_READY_OK, STOCKFISH_LOAD_TIMEOUT_MS);
    send(UCI_NEW_GAME);
  };

  return boot()
    .then(() => {
      const engine: StockfishEngine = {
        bestMove: (fen: string) =>
          run(async () => {
            send(`${UCI_POSITION_PREFIX}${fen}`);
            send(`${UCI_GO_DEPTH_PREFIX}${STOCKFISH_GO_DEPTH}`);
            const line = await waitForLine(
              worker,
              (value) => parseBestMove(value) !== null || value.startsWith(UCI_BESTMOVE_PREFIX),
              STOCKFISH_MOVE_TIMEOUT_MS,
            );
            return parseBestMove(line);
          }),
        stop: () => {
          send(UCI_STOP);
        },
        terminate: () => {
          send(UCI_QUIT);
          worker.terminate();
        },
      };
      return engine;
    })
    .catch((error: unknown) => {
      worker.terminate();
      throw error instanceof Error ? error : new Error(STOCKFISH_ERROR.load);
    });
}
