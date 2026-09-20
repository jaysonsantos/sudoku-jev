import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage } from "../../shared/src/index.ts";
import { GAME_STATUS, isChessDecisionMessage, MAX_MISTAKES, MESSAGE_TYPE } from "../../shared/src/index.ts";
import { BoardView } from "./components/BoardView.tsx";
import type { LogLine } from "./components/LogView.tsx";
import { LogView } from "./components/LogView.tsx";
import { NAV_PAGE, Nav } from "./components/Nav.tsx";
import { MAX_LOG_LINES, PERCENT, STEP_DELAY_MS } from "./constants.ts";
import type { Game } from "./game.ts";
import { applyMove, newGame, toStateMessage } from "./game.ts";
import { SOCKET_STATUS, useJevSocket } from "./useJevSocket.ts";

function formatCell(row: number, col: number): string {
  return `r${row + 1}c${col + 1}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * PERCENT)}%`;
}

export function App() {
  const [game, setGame] = useState<Game>(() => newGame());
  const [lines, setLines] = useState<LogLine[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [solving, setSolving] = useState(false);
  const nextLineId = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  const log = useCallback((kind: LogLine["kind"], text: string) => {
    nextLineId.current += 1;
    const line: LogLine = { id: nextLineId.current, kind, text };
    setLines((previous) => [line, ...previous].slice(0, MAX_LOG_LINES));
  }, []);

  const onMessage = useCallback(
    (message: ServerMessage) => {
      setWaiting(false);
      const current = gameRef.current;
      if (message.game_id !== null && message.game_id !== current.id) {
        return;
      }
      switch (message.type) {
        case MESSAGE_TYPE.decision: {
          if (isChessDecisionMessage(message)) {
            return;
          }
          const next = applyMove(current, message.move);
          const cell = formatCell(message.move.row, message.move.col);
          const stats = `p=${formatPercent(message.probability)} conf=${formatPercent(message.confidence)} options=${message.options_considered} in ${message.latency_ms}ms`;
          log(
            next.lastWasWrong ? "wrong" : "move",
            `${next.lastWasWrong ? "wrong" : "placed"} ${message.move.value} at ${cell} (${stats})`,
          );
          if (next.status === GAME_STATUS.won) {
            log("info", "solved");
          } else if (next.status === GAME_STATUS.lost) {
            log("info", `lost after ${next.mistakes} mistakes`);
          }
          setGame(next);
          break;
        }
        case MESSAGE_TYPE.finished:
          log("info", `server: ${message.reason}`);
          if (message.status !== current.status) {
            setGame({ ...current, status: message.status });
          }
          break;
        case MESSAGE_TYPE.error:
          log("error", message.message);
          break;
      }
    },
    [log],
  );

  const socket = useJevSocket(onMessage);

  // Report the state after every change while Jev solves, the game runs, and the socket is open.
  useEffect(() => {
    if (!solving || game.status !== GAME_STATUS.playing || socket.status !== SOCKET_STATUS.open || waiting) {
      return;
    }
    const timer = setTimeout(() => {
      if (socket.send(toStateMessage(game))) {
        setWaiting(true);
      }
    }, STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, socket, waiting, solving]);

  // Stop when the game ends, so a new game waits for the next click.
  useEffect(() => {
    if (game.status !== GAME_STATUS.playing) {
      setSolving(false);
    }
  }, [game.status]);

  const restart = (): void => {
    setGame(newGame());
    setLines([]);
    setWaiting(false);
    setSolving(false);
    log("info", "new game");
  };

  const toggleSolve = (): void => {
    if (solving) {
      setSolving(false);
      log("info", "paused");
      return;
    }
    setSolving(true);
    log("info", "Jev solves");
  };

  const canSolve = game.status === GAME_STATUS.playing && socket.status === SOCKET_STATUS.open;

  return (
    <main>
      <header>
        <Nav current={NAV_PAGE.sudoku} />
        <h1>Sudoku played by Jev</h1>
        <p className="meta">
          <span className={`status socket-${socket.status}`}>socket: {socket.status}</span>
          <span className={`status game-${game.status}`}>game: {game.status}</span>
          <span>
            mistakes: {game.mistakes}/{MAX_MISTAKES}
          </span>
          <button type="button" onClick={toggleSolve} disabled={!canSolve}>
            {solving ? "Pause" : "Solve"}
          </button>
          <button type="button" onClick={restart}>
            New game
          </button>
        </p>
      </header>
      <section className="layout">
        <BoardView game={game} />
        <LogView lines={lines} />
      </section>
    </main>
  );
}
