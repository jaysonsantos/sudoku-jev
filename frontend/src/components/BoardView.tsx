import { BOX_SIZE, EMPTY } from "../../../shared/src/index.ts";
import type { Game } from "../game.ts";
import { isGiven } from "../game.ts";

interface Props {
  game: Game;
}

export function BoardView({ game }: Props) {
  return (
    <table className="board" aria-label="sudoku board">
      <tbody>
        {game.board.map((row, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have a fixed position
          <tr key={r}>
            {row.map((cell, c) => {
              const last = game.lastMove !== null && game.lastMove.row === r && game.lastMove.col === c;
              const classes = [
                "cell",
                isGiven(game, r, c) ? "given" : "filled",
                last ? (game.lastWasWrong ? "wrong" : "last") : "",
                c % BOX_SIZE === BOX_SIZE - 1 ? "box-right" : "",
                r % BOX_SIZE === BOX_SIZE - 1 ? "box-bottom" : "",
              ]
                .filter((name) => name.length > 0)
                .join(" ");
              const shown = cell === EMPTY ? (last && game.lastWasWrong ? game.lastMove?.value : "") : cell;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells have a fixed position
                <td key={c} className={classes}>
                  {shown}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
