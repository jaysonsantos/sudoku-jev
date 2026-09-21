import { CHESS_PATH, SUDOKU_PATH } from "../../../shared/src/index.ts";
import {
  GITHUB_LINK_REL,
  GITHUB_LINK_TARGET,
  GITHUB_REPO_LABEL,
  GITHUB_REPO_URL,
  NAV_ARIA_LABEL,
  NAV_CHESS_LABEL,
  NAV_SUDOKU_LABEL,
} from "../constants.ts";

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
    <nav className="nav" aria-label={NAV_ARIA_LABEL}>
      <a href={SUDOKU_PATH} aria-current={current === NAV_PAGE.sudoku ? "page" : undefined}>
        {NAV_SUDOKU_LABEL}
      </a>
      <a href={CHESS_PATH} aria-current={current === NAV_PAGE.chess ? "page" : undefined}>
        {NAV_CHESS_LABEL}
      </a>
      <a className="nav-github" href={GITHUB_REPO_URL} target={GITHUB_LINK_TARGET} rel={GITHUB_LINK_REL}>
        {GITHUB_REPO_LABEL}
      </a>
    </nav>
  );
}
