# sudoku-jev

A sudoku game that the TypeSafe Jev decision model plays through OpenRouter.

## Paths

| Path | Purpose |
|---|---|
| `shared/src/` | Sudoku rules, generator, solver, protocol types. Used by both trees. |
| `backend/src/` | Node HTTP and websocket server. Asks Jev for one move per state. |
| `frontend/src/` | React single page app. Makes the puzzle, keeps the solution, applies moves. |
| `test/` | `node --test` suites for `shared/` and `backend/`. |
| `scripts/` | `lint.sh`, `test.sh`, `all.sh`, `release.sh`. CI runs the same scripts. |
| `frontend/dist/` | Vite build output. The backend serves it. Not committed. |

## Commands

| Task | Command |
|---|---|
| Dev shell | `direnv allow` (reads `.env` and `flake.nix`) |
| Install | `pnpm install --frozen-lockfile` |
| Dev servers | `pnpm dev` (backend on 8080, Vite on 5173 with a proxy for `/ws`) |
| Lint | `scripts/lint.sh` (`prek run --all-files`) |
| Test | `scripts/test.sh` (typecheck plus `node --test`) |
| Build | `pnpm build` |
| Run | `pnpm start` |
| Release | `scripts/release.sh`, then `git push --follow-tags` |

## Rules

- Use pnpm, never npm.
- Import with the `.ts` extension. The backend runs the sources with Node type stripping, so use no enums and no parameter properties.
- Keep sudoku rules in `shared/`. Do not copy them into a tree.
- Put every limit and name in a constants block. No literal numbers or strings inside logic.
- The client owns the solution and the game status. The server never sees the solution.
- Message shapes live in `shared/src/types.ts`. Change them there only.
- Commit messages follow Conventional Commits. Never write a version by hand.

## Jev through OpenRouter

- Endpoint: `POST https://openrouter.ai/api/alpha/decisions`. The chat completions endpoint rejects the model.
- Model id: `typesafe/jev-1.13`. Body: `{ model, state, questions }`. A `choice` question has `instructions` and `criteria` (option id to description).
- One choice question holds at most 255 options. The backend splits the legal moves into batches and sends every batch in one request.
- Option ids are `row_R_col_C_value_V`, one based. The backend parses them back into moves.
- Jev counts and calculates poorly. It reads `cell_candidates` in each option, which the code computes.
