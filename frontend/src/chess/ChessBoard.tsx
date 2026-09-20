import chessboardSrc from "@chrisoakman/chessboardjs/dist/chessboard-1.0.0.js?url";
import jquery from "jquery";
import { useEffect, useRef } from "react";
import "@chrisoakman/chessboardjs/dist/chessboard-1.0.0.css";
import type { ChessColor, ChessMove } from "../../../shared/src/index.ts";
import type { ChessboardApi, ChessboardFn } from "../chessboard.d.ts";
import { CHESS_PIECE_THEME, CHESSBOARD_HIGHLIGHT_FROM, CHESSBOARD_HIGHLIGHT_TO } from "../constants.ts";

let chessboardLoader: Promise<ChessboardFn> | null = null;

function loadChessboard(): Promise<ChessboardFn> {
  if (window.Chessboard !== undefined) {
    return Promise.resolve(window.Chessboard);
  }
  if (chessboardLoader !== null) {
    return chessboardLoader;
  }
  window.jQuery = jquery;
  window.$ = jquery;
  chessboardLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chessboardSrc;
    script.onload = () => {
      if (window.Chessboard === undefined) {
        reject(new Error("chessboard.js did not attach Chessboard"));
        return;
      }
      resolve(window.Chessboard);
    };
    script.onerror = () => reject(new Error("failed to load chessboard.js"));
    document.head.appendChild(script);
  });
  return chessboardLoader;
}

function highlightLastMove(host: HTMLElement, lastMove: ChessMove | null): void {
  for (const square of host.querySelectorAll(`.${CHESSBOARD_HIGHLIGHT_FROM}, .${CHESSBOARD_HIGHLIGHT_TO}`)) {
    square.classList.remove(CHESSBOARD_HIGHLIGHT_FROM, CHESSBOARD_HIGHLIGHT_TO);
  }
  if (lastMove === null) {
    return;
  }
  host.querySelector(`.square-${lastMove.from}`)?.classList.add(CHESSBOARD_HIGHLIGHT_FROM);
  host.querySelector(`.square-${lastMove.to}`)?.classList.add(CHESSBOARD_HIGHLIGHT_TO);
}

interface Props {
  fen: string;
  orientation: ChessColor;
  lastMove: ChessMove | null;
}

export function ChessBoard({ fen, orientation, lastMove }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<ChessboardApi | null>(null);
  const fenRef = useRef(fen);
  const lastMoveRef = useRef(lastMove);
  fenRef.current = fen;
  lastMoveRef.current = lastMove;

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    let cancelled = false;
    let board: ChessboardApi | null = null;
    loadChessboard()
      .then((Chessboard) => {
        if (cancelled || hostRef.current === null) {
          return;
        }
        board = Chessboard(hostRef.current, {
          position: fenRef.current,
          orientation,
          draggable: false,
          pieceTheme: CHESS_PIECE_THEME,
        });
        boardRef.current = board;
        highlightLastMove(hostRef.current, lastMoveRef.current);
      })
      .catch(() => {
        if (hostRef.current !== null) {
          hostRef.current.textContent = "chessboard.js failed to load";
        }
      });
    const onResize = (): void => {
      boardRef.current?.resize();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      board?.destroy();
      boardRef.current = null;
      host.replaceChildren();
    };
  }, [orientation]);

  useEffect(() => {
    const board = boardRef.current;
    const host = hostRef.current;
    if (board === null || host === null) {
      return;
    }
    board.position(fen, true);
    highlightLastMove(host, lastMove);
  }, [fen, lastMove]);

  return <div ref={hostRef} className="chessboard-host" />;
}
