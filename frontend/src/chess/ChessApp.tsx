import { useCallback, useEffect, useRef, useState } from "react";
import type { ChessColor, ServerMessage } from "../../../shared/src/index.ts";
import {
  CHESS_CLOCK_TICK_MS,
  CHESS_COLOR,
  formatChessClock,
  GAME_STATUS,
  isChessDecisionMessage,
  MESSAGE_TYPE,
  sideToMove,
} from "../../../shared/src/index.ts";
import type { LogLine } from "../components/LogView.tsx";
import { LogView } from "../components/LogView.tsx";
import { NAV_PAGE, Nav } from "../components/Nav.tsx";
import {
  ASKS_JEV_SUFFIX,
  CHESS_TITLE,
  MAX_LOG_LINES,
  PERCENT,
  PLAY_BOTH_LABEL,
  PLAYER_TITLE,
  SHARED_BOARD_LABEL,
  SHARED_FEN_LABEL,
  SIDE_TO_MOVE_LABEL,
  STEP_DELAY_MS,
  TURN_WAITING,
  TURN_YOURS,
  YOU_ARE_PREFIX,
} from "../constants.ts";
import { SOCKET_STATUS, useJevSocket } from "../useJevSocket.ts";
import { ChessBoard } from "./ChessBoard.tsx";
import type { ChessGame } from "./chessGame.ts";
import { applyChessDecision, newChessGame, playerTurn, tickChessGame, toChessStateMessage } from "./chessGame.ts";

function formatPercent(value: number): string {
  return `${Math.round(value * PERCENT)}%`;
}

function PlayerClock({ game, color }: { game: ChessGame; color: ChessColor }) {
  const turn = playerTurn(game, color);
  return (
    <section className={turn ? "player-clock active" : "player-clock"} aria-label={PLAYER_TITLE[color]}>
      <p className="player-color">
        {YOU_ARE_PREFIX}
        {color}
      </p>
      <p className={turn ? "turn-label active" : "turn-label"}>{turn ? TURN_YOURS : TURN_WAITING}</p>
      <time className="clock">{formatChessClock(game.clocks[color])}</time>
    </section>
  );
}

export function ChessApp() {
  const [game, setGame] = useState<ChessGame>(() => newChessGame());
  const [lines, setLines] = useState<LogLine[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const nextLineId = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    document.title = CHESS_TITLE;
  }, []);

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
          if (!isChessDecisionMessage(message)) {
            log("error", "server sent a sudoku decision on /chess");
            return;
          }
          const next = applyChessDecision(current, message.move);
          if (next.fen === current.fen) {
            log("error", `rejected illegal move ${message.move.uci}`);
            setPlaying(false);
            return;
          }
          const stats = `p=${formatPercent(message.probability)} conf=${formatPercent(message.confidence)} options=${message.options_considered} rerolls=${message.rerolls} in ${message.latency_ms}ms`;
          log("move", `${message.move.san} (${message.move.uci}) for ${next.lastColor} (${stats})`);
          if (next.status !== GAME_STATUS.playing && next.reason !== null) {
            log("info", next.reason);
          }
          setGame(next);
          break;
        }
        case MESSAGE_TYPE.finished:
          log("info", `server: ${message.reason}`);
          if (message.status !== current.status) {
            setGame({ ...current, status: message.status, reason: message.reason });
          }
          break;
        case MESSAGE_TYPE.error:
          log("error", message.message);
          setPlaying(false);
          break;
      }
    },
    [log],
  );

  const socket = useJevSocket(onMessage);

  useEffect(() => {
    if (!playing || game.status !== GAME_STATUS.playing || socket.status !== SOCKET_STATUS.open || waiting) {
      return;
    }
    const color = sideToMove(game.fen);
    const timer = setTimeout(() => {
      if (socket.send(toChessStateMessage(game))) {
        setWaiting(true);
        log("info", `${color}${ASKS_JEV_SUFFIX}`);
      }
    }, STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, socket, waiting, playing, log]);

  useEffect(() => {
    if (!playing || game.status !== GAME_STATUS.playing) {
      return;
    }
    const timer = setInterval(() => {
      setGame((current) => {
        const next = tickChessGame(current, CHESS_CLOCK_TICK_MS);
        if (next.status !== current.status && next.reason !== null) {
          log("info", next.reason);
        }
        return next;
      });
    }, CHESS_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [playing, game.status, log]);

  useEffect(() => {
    if (game.status !== GAME_STATUS.playing) {
      setPlaying(false);
    }
  }, [game.status]);

  const restart = (): void => {
    setGame(newChessGame());
    setLines([]);
    setWaiting(false);
    setPlaying(false);
    log("info", "new game");
  };

  const togglePlay = (): void => {
    if (playing) {
      setPlaying(false);
      log("info", "paused");
      return;
    }
    setPlaying(true);
    log("info", PLAY_BOTH_LABEL);
  };

  const canPlay = game.status === GAME_STATUS.playing && socket.status === SOCKET_STATUS.open;
  const turn = sideToMove(game.fen);

  return (
    <main>
      <header>
        <Nav current={NAV_PAGE.chess} />
        <h1>{CHESS_TITLE}</h1>
        <p className="meta">
          <span className={`status socket-${socket.status}`}>socket: {socket.status}</span>
          <span className={`status game-${game.status}`}>game: {game.status}</span>
          <span>
            {SIDE_TO_MOVE_LABEL}: {turn}
          </span>
          <button type="button" onClick={togglePlay} disabled={!canPlay}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={restart}>
            New game
          </button>
        </p>
      </header>
      <section className="layout chess-layout">
        <section className="shared-board" aria-label={SHARED_BOARD_LABEL}>
          <PlayerClock game={game} color={CHESS_COLOR.black} />
          <ChessBoard fen={game.fen} orientation={CHESS_COLOR.white} lastMove={game.lastMove} />
          <PlayerClock game={game} color={CHESS_COLOR.white} />
          <dl className="player-state" aria-label={SHARED_BOARD_LABEL}>
            <div>
              <dt>{SHARED_FEN_LABEL}</dt>
              <dd>{game.fen}</dd>
            </div>
            <div>
              <dt>{SIDE_TO_MOVE_LABEL}</dt>
              <dd>{turn}</dd>
            </div>
          </dl>
        </section>
        <LogView lines={lines} />
      </section>
    </main>
  );
}
