import { CHESS_PATH, SUDOKU_PATH } from "../../../shared/src/index.ts";

export const NAV_PAGE = {
  sudoku: "sudoku",
  chess: "chess",
} as const;
export type NavPage = (typeof NAV_PAGE)[keyof typeof NAV_PAGE];

interface Props {
  current: NavPage;
}

export function Nav({ current }: Props) {
  return (
    <nav className="nav" aria-label="games">
      <a href={SUDOKU_PATH} aria-current={current === NAV_PAGE.sudoku ? "page" : undefined}>
        Sudoku
      </a>
      <a href={CHESS_PATH} aria-current={current === NAV_PAGE.chess ? "page" : undefined}>
        Chess
      </a>
    </nav>
  );
}
