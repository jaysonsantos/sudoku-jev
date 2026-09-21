import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STOCKFISH_ERROR, STOCKFISH_STATUS, type StockfishStatus } from "../constants.ts";
import type { StockfishEngine } from "./stockfishEngine.ts";
import { createStockfishEngine } from "./stockfishEngine.ts";

export interface StockfishHook {
  status: StockfishStatus;
  bestMove: (fen: string) => Promise<string | null>;
  stop: () => void;
}

export function useStockfish(): StockfishHook {
  const [status, setStatus] = useState<StockfishStatus>(STOCKFISH_STATUS.loading);
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    createStockfishEngine()
      .then((engine) => {
        if (cancelled) {
          engine.terminate();
          return;
        }
        engineRef.current = engine;
        setStatus(STOCKFISH_STATUS.ready);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(STOCKFISH_STATUS.error);
        }
      });
    return () => {
      cancelled = true;
      engineRef.current?.terminate();
      engineRef.current = null;
    };
  }, []);

  const bestMove = useCallback(async (fen: string): Promise<string | null> => {
    const engine = engineRef.current;
    if (engine === null) {
      throw new Error(STOCKFISH_ERROR.load);
    }
    return engine.bestMove(fen);
  }, []);

  const stop = useCallback((): void => {
    engineRef.current?.stop();
  }, []);

  return useMemo(() => ({ status, bestMove, stop }), [status, bestMove, stop]);
}
