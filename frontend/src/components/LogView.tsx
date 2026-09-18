export interface LogLine {
  id: number;
  text: string;
  kind: "info" | "move" | "wrong" | "error";
}

interface Props {
  lines: LogLine[];
}

export function LogView({ lines }: Props) {
  return (
    <ol className="log" aria-label="decision log">
      {lines.map((line) => (
        <li key={line.id} className={line.kind}>
          {line.text}
        </li>
      ))}
    </ol>
  );
}
