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
  ASKS_STOCKFISH_SUFFIX,
  CHESS_PLAYER,
  CHESS_TITLE,
  MAX_LOG_LINES,
  PERCENT,
  PLAY_MATCH_LABEL,
  SHARED_BOARD_LABEL,
  SHARED_FEN_LABEL,
  SIDE_TO_MOVE_LABEL,
  STEP_DELAY_MS,
  STOCKFISH_ERROR,
  STOCKFISH_ILLEGAL_RETRIES,
  STOCKFISH_LOG_TAG,
  STOCKFISH_STATUS,
  STOCKFISH_STATUS_PREFIX,
  TURN_TO_MOVE,
  TURN_WAITING,
} from "../constants.ts";
import { SOCKET_STATUS, useJevSocket } from "../useJevSocket.ts";
import { ChessBoard } from "./ChessBoard.tsx";
import type { ChessGame } from "./chessGame.ts";
import {
  applyOrRejectChessDecision,
  chessActorToMove,
  chessAskKey,
  decideStockfishMove,
  formatPlayerColorLabel,
  newChessGame,
  pairingSummary,
  playerTurn,
  shouldAskJev,
  shouldAskStockfish,
  tickChessGame,
  toChessStateMessage,
} from "./chessGame.ts";
import { useStockfish } from "./useStockfish.ts";

function formatPercent(value: number): string {
  return `${Math.round(value * PERCENT)}%`;
}

function PlayerClock({ game, color }: { game: ChessGame; color: ChessColor }) {
  const turn = playerTurn(game, color);
  const player = game.players[color];
  return (
    <section
      className={turn ? "player-clock active" : "player-clock"}
      aria-label={formatPlayerColorLabel(player, color)}
    >
      <p className="player-color">{formatPlayerColorLabel(player, color)}</p>
      <p className={turn ? "turn-label active" : "turn-label"}>{turn ? TURN_TO_MOVE : TURN_WAITING}</p>
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
  const stockfish = useStockfish();
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    document.title = CHESS_TITLE;
  }, []);

  const log = useCallback((kind: LogLine["kind"], text: string) => {
    nextLineId.current += 1;
    const line: LogLine = { id: nextLineId.current, kind, text };
    setLines((previous) => [line, ...previous].slice(0, MAX_LOG_LINES));
  }, []);

  useEffect(() => {
    log("info", pairingSummary(gameRef.current));
  }, [log]);

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
          if (!shouldAskJev(current)) {
            log("error", "ignored a Jev decision on Stockfish's turn");
            return;
          }
          const next = applyOrRejectChessDecision(current, message.move);
          if (next.fen === current.fen) {
            log("error", `rejected illegal move ${message.move.uci}`);
            setGame(next);
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

  const { status: socketStatus, send } = useJevSocket(onMessage);
  const askKey = chessAskKey(game);

  // Schedule from the position, not the clock. Ticks rewrite `game` every
  // CHESS_CLOCK_TICK_MS, which is shorter than STEP_DELAY_MS.
  useEffect(() => {
    const current = gameRef.current;
    if (!playing || current.status !== GAME_STATUS.playing || waiting) {
      return;
    }
    const actor = chessActorToMove(current);
    const color = sideToMove(current.fen);
    if (actor === CHESS_PLAYER.jev) {
      if (socketStatus !== SOCKET_STATUS.open) {
        return;
      }
      const timer = setTimeout(() => {
        const latest = gameRef.current;
        if (chessAskKey(latest) !== askKey || !shouldAskJev(latest)) {
          return;
        }
        if (send(toChessStateMessage(latest))) {
          setWaiting(true);
          log("info", `${color}${ASKS_JEV_SUFFIX}`);
        }
      }, STEP_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (actor === CHESS_PLAYER.stockfish) {
      if (stockfish.status !== STOCKFISH_STATUS.ready) {
        return;
      }
      const timer = setTimeout(() => {
        const latest = gameRef.current;
        if (chessAskKey(latest) !== askKey || !shouldAskStockfish(latest)) {
          return;
        }
        setWaiting(true);
        log("info", `${color}${ASKS_STOCKFISH_SUFFIX}`);
        decideStockfishMove(latest, stockfish.bestMove, STOCKFISH_ILLEGAL_RETRIES)
          .then((result) => {
            if (!playingRef.current || chessAskKey(gameRef.current) !== askKey) {
              return;
            }
            if (!result.ok) {
              setGame(result.game);
              setPlaying(false);
              setWaiting(false);
              log("error", STOCKFISH_ERROR.illegalAfterRetry);
              return;
            }
            log("move", `${result.move.san} (${result.move.uci}) for ${result.game.lastColor} (${STOCKFISH_LOG_TAG})`);
            if (result.game.status !== GAME_STATUS.playing && result.game.reason !== null) {
              log("info", result.game.reason);
            }
            setGame(result.game);
            setWaiting(false);
          })
          .catch((error: unknown) => {
            if (!playingRef.current || chessAskKey(gameRef.current) !== askKey) {
              return;
            }
            setPlaying(false);
            setWaiting(false);
            log("error", error instanceof Error ? error.message : STOCKFISH_ERROR.timeout);
          });
      }, STEP_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [askKey, send, socketStatus, waiting, playing, log, stockfish.bestMove, stockfish.status]);

  useEffect(() => {
    if (!playing) {
      stockfish.stop();
    }
  }, [playing, stockfish.stop]);

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
    const next = newChessGame();
    setGame(next);
    setLines([]);
    setWaiting(false);
    setPlaying(false);
    log("info", `new game: ${pairingSummary(next)}`);
  };

  const togglePlay = (): void => {
    if (playing) {
      setPlaying(false);
      stockfish.stop();
      log("info", "paused");
      return;
    }
    setPlaying(true);
    log("info", `${PLAY_MATCH_LABEL}: ${pairingSummary(game)}`);
  };

  const canPlay =
    game.status === GAME_STATUS.playing &&
    socketStatus === SOCKET_STATUS.open &&
    stockfish.status === STOCKFISH_STATUS.ready;
  const turn = sideToMove(game.fen);

  return (
    <main>
      <header>
        <Nav current={NAV_PAGE.chess} />
        <h1>{CHESS_TITLE}</h1>
        <p className="meta">
          <span className={`status socket-${socketStatus}`}>socket: {socketStatus}</span>
          <span className={`status stockfish-${stockfish.status}`}>
            {STOCKFISH_STATUS_PREFIX}
            {stockfish.status}
          </span>
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
