export interface ChessboardApi {
  position(fen: string, useAnimation?: boolean): void;
  orientation(color: string): void;
  resize(): void;
  destroy(): void;
}

export interface ChessboardConfig {
  position: string;
  orientation: string;
  draggable: boolean;
  pieceTheme: string;
}

export type ChessboardFn = (el: HTMLElement, config: ChessboardConfig) => ChessboardApi;

declare global {
  interface Window {
    Chessboard?: ChessboardFn;
    jQuery: JQueryStatic;
    $: JQueryStatic;
  }
}
