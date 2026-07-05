// Minimal keyboard parser for raw-mode stdin. Maps escape sequences and control
// characters to stable key names; returns the raw character otherwise.
export type Key =
  | "up" | "down" | "left" | "right"
  | "enter" | "esc" | "backspace" | "tab"
  | "ctrl-c" | string;

export function parseKey(data: Buffer | string): Key {
  const s = typeof data === "string" ? data : data.toString("utf8");
  switch (s) {
    case "\x03": return "ctrl-c";
    case "\r":
    case "\n": return "enter";
    case "\x1b": return "esc";
    case "\x1b[A":
    case "\x1bOA": return "up";
    case "\x1b[B":
    case "\x1bOB": return "down";
    case "\x1b[C":
    case "\x1bOC": return "right";
    case "\x1b[D":
    case "\x1bOD": return "left";
    case "\x7f":
    case "\b": return "backspace";
    case "\t": return "tab";
    default: return s;
  }
}
