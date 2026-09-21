# sudoku-jev

A sudoku game that the TypeSafe Jev decision model plays through OpenRouter.

## Paths

| Path | Purpose |
|---|---|
| `shared/src/` | Sudoku and chess rules, generator, solver, protocol types. Used by both trees. |
| `backend/src/` | Node HTTP and websocket server. Asks Jev for one move per state (sudoku or chess). |
| `cloudflare/src/` | Worker plus Durable Object. Terminates `/ws` on Cloudflare. Reuses `backend/` Jev code. |
| `frontend/src/` | React SPA. `/` is sudoku; `/chess` is Jev vs Stockfish on one shared chessboard.js board. |
| `test/` | `node --test` suites for `shared/`, `backend/`, and `cloudflare/`. |
| `scripts/` | `lint.sh`, `test.sh`, `all.sh`, `release.sh`. CI runs the same scripts. |
| `frontend/dist/` | Vite build output. The Node server and the Worker assets serve it. Not committed. |
| `docs/` | Standalone HTML explainer of the Jev loop, served by GitHub Pages from `main`. |

## Commands

| Task | Command |
|---|---|
| Dev shell | `direnv allow` (reads `.env` and `flake.nix`) |
| Install | `pnpm install --frozen-lockfile` |
| Dev servers | `pnpm dev` (backend on 8080, Vite on 5173 with a proxy for `/ws`) |
| Cloudflare local | `pnpm cf:dev` (`wrangler dev` after a frontend build) |
| Lint | `scripts/lint.sh` (`prek run --all-files`) |
| Test | `scripts/test.sh` (typecheck plus `node --test`) |
| Build | `pnpm build` |
| Run | `pnpm start` |
| Cloudflare deploy | `pnpm cf:deploy` (put `OPENROUTER_API_KEY` with `wrangler secret put` first) |
| Release | `scripts/release.sh`, then `git push --follow-tags` |

## Rules

- Use pnpm, never npm.
- Import with the `.ts` extension. The backend runs the sources with Node type stripping, so use no enums and no parameter properties.
- Keep sudoku and chess rules in `shared/`. Do not copy them into a tree.
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
- Chess option ids are `uci_e2e4`. The backend offers at most 150 legal UCIs (sorted, then sliced). Jev's pick is checked with chess.js. An illegal or unknown pick is dropped and the same position is asked once more. A second failure is an error.
- On `/chess` the browser randomly assigns Jev one color and Stockfish the other. Only Jev's turn uses `/ws`. Stockfish is [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) lite-single WASM and must not run as a native binary on the Worker.
- Chess decisions may include optional `cost` (OpenRouter USD). The client sums Jev calls; Stockfish is `$0`. When the game ends the UI shows `match cost: $0.0123`.

## Cloudflare

Cloudflare Workflows cannot host a WebSocket. The Worker serves `/healthz` and upgrades `/ws` to a `GameSession` Durable Object (binding `GAME_SESSION`, one object per browser session, hibernation API). The frontend still opens same-origin `/ws`. SPA assets serve `/` and `/chess`.

| Route | Handler |
|---|---|
| `/` | SPA (sudoku) |
| `/chess` | SPA (Jev vs Stockfish) |
| `/ws` | Worker → `GameSession` (sudoku and chess messages) |
| `/healthz` | Worker health |
