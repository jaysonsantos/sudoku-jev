import { useCallback, useEffect, useRef, useState } from "react";
import type { ChessColor, ServerMessage } from "../../../shared/src/index.ts";
import {
  CHESS_COLOR,
  GAME_KIND,
  GAME_STATUS,
  isChessDecisionMessage,
  MESSAGE_TYPE,
  sideToMove,
} from "../../../shared/src/index.ts";
import type { LogLine } from "../components/LogView.tsx";
import { LogView } from "../components/LogView.tsx";
import { NAV_PAGE, Nav } from "../components/Nav.tsx";
import {
  CHESS_TITLE,
  EMPTY_STATE_VALUE,
  MAX_LOG_LINES,
  PERCENT,
  PLAY_BOTH_LABEL,
  PLAYER_TITLE,
  STEP_DELAY_MS,
  TURN_WAITING,
  TURN_YOURS,
  YOU_ARE_PREFIX,
} from "../constants.ts";
import { SOCKET_STATUS, useJevSocket } from "../useJevSocket.ts";
import { ChessBoard } from "./ChessBoard.tsx";
import type { ChessGame } from "./chessGame.ts";
import { applyChessDecision, newChessGame, playerTurn, toChessStateMessage } from "./chessGame.ts";

function formatPercent(value: number): string {
  return `${Math.round(value * PERCENT)}%`;
}

function playerState(game: ChessGame, color: ChessColor): Record<string, string | null> {
  const last = game.lastColor === color ? game.lastMove : null;
  return {
    game: GAME_KIND.chess,
    player_color: color,
    fen: game.fen,
    side_to_move: sideToMove(game.fen),
    last_move: last?.san ?? null,
  };
}

function PlayerPanel({ game, color }: { game: ChessGame; color: ChessColor }) {
  const turn = playerTurn(game, color);
  const state = playerState(game, color);
  const title = PLAYER_TITLE[color];
  return (
    <article className={turn ? "player-panel turn" : "player-panel"} aria-label={title}>
      <h2>{title}</h2>
      <p className="player-color">
        {YOU_ARE_PREFIX}
        {color}
      </p>
      <p className={turn ? "turn-label active" : "turn-label"}>{turn ? TURN_YOURS : TURN_WAITING}</p>
      <ChessBoard fen={game.fen} orientation={color} lastMove={game.lastMove} />
      <dl className="player-state" aria-label={`${color} state`}>
        {Object.entries(state).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value ?? EMPTY_STATE_VALUE}</dd>
          </div>
        ))}
      </dl>
    </article>
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
    const timer = setTimeout(() => {
      if (socket.send(toChessStateMessage(game))) {
        setWaiting(true);
      }
    }, STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, socket, waiting, playing]);

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

  return (
    <main>
      <header>
        <Nav current={NAV_PAGE.chess} />
        <h1>{CHESS_TITLE}</h1>
        <p className="meta">
          <span className={`status socket-${socket.status}`}>socket: {socket.status}</span>
          <span className={`status game-${game.status}`}>game: {game.status}</span>
          <span>side: {sideToMove(game.fen)}</span>
          <button type="button" onClick={togglePlay} disabled={!canPlay}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={restart}>
            New game
          </button>
        </p>
      </header>
      <section className="layout chess-layout">
        <section className="players" aria-label="two players">
          <PlayerPanel game={game} color={CHESS_COLOR.white} />
          <PlayerPanel game={game} color={CHESS_COLOR.black} />
        </section>
        <LogView lines={lines} />
      </section>
    </main>
  );
}
