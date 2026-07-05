// ANSI theme for the "ink/forge" identity (see docs/design/ink-style.md), with
// graceful fallbacks: truecolor -> 16-color -> no color, and Unicode -> ASCII.
import type { ScoreResult, Severity } from "../../../lib/skill-lint";

export interface ThemeCaps {
  color: boolean;
  truecolor: boolean;
  unicode: boolean;
}

export interface Theme {
  caps: ThemeCaps;
  fg: (hex: string, s: string) => string;
  bold: (s: string) => string;
  dim: (s: string) => string;
  severity: (sev: Severity, s: string) => string;
  band: (band: ScoreResult["band"], s: string) => string;
  bar: (pct: number, width: number) => string;
  box: BoxChars;
}

interface BoxChars {
  tl: string; tr: string; bl: string; br: string; h: string; v: string;
}

// Palette from ink-style.md (dark/"night forge" values read well on terminals).
const EMBER = "#FF8A4A";
const INK_SOFT = "#A39A8B";
const SEV: Record<Severity, string> = {
  error: "#E5484D",
  warning: "#D9A03F",
  suggestion: "#6CA9E0",
};
const BAND: Record<ScoreResult["band"], string> = {
  excellent: "#FF8A4A",
  good: "#A39A8B",
  "needs-work": "#D9A03F",
  poor: "#E5484D",
};

export { EMBER, INK_SOFT };

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

// The 8 bright ANSI colors (90–97) as RGB anchors for nearest-match fallback.
const ANSI16: Array<[number, [number, number, number]]> = [
  [90, [85, 85, 85]], [91, [255, 85, 85]], [92, [85, 255, 85]], [93, [255, 255, 85]],
  [94, [85, 85, 255]], [95, [255, 85, 255]], [96, [85, 255, 255]], [97, [255, 255, 255]],
];

const nearest16 = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  let best = 97;
  let bestD = Infinity;
  for (const [code, [cr, cg, cb]] of ANSI16) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = code; }
  }
  return best;
};

/** Detect terminal capabilities from env + flags. */
export function detectCaps(opts: { noColor?: boolean; isTTY?: boolean } = {}): ThemeCaps {
  const env = process.env;
  const noColor = opts.noColor || env.NO_COLOR != null || env.TERM === "dumb";
  const forced = /^(1|true)$/i.test(env.FORCE_COLOR || "");
  // Color only on a real TTY (or when forced). A pipe/CI (isTTY undefined/false)
  // gets plain text, so redirected output stays clean.
  const color = !noColor && (forced || opts.isTTY === true);
  const truecolor = color && /truecolor|24bit/i.test(env.COLORTERM || "");
  // Windows Terminal, VS Code, and modern *nix terminals handle box-drawing.
  const unicode = !/^(1|true)$/i.test(env.SKILLSMITH_ASCII || "") && env.TERM !== "linux";
  return { color, truecolor, unicode };
}

export function makeTheme(caps: ThemeCaps): Theme {
  const wrap = (open: string, s: string) => `\x1b[${open}m${s}\x1b[0m`;
  const fg = (hex: string, s: string): string => {
    if (!caps.color) return s;
    if (caps.truecolor) {
      const [r, g, b] = rgb(hex);
      return wrap(`38;2;${r};${g};${b}`, s);
    }
    return wrap(String(nearest16(hex)), s);
  };
  const box: BoxChars = caps.unicode
    ? { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" }
    : { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" };
  const barChars = caps.unicode ? { full: "█", empty: "░" } : { full: "#", empty: "-" };

  const bar = (pct: number, width: number): string => {
    const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
    const hex = pct >= 85 ? EMBER : pct >= 60 ? INK_SOFT : SEV.warning;
    return fg(hex, barChars.full.repeat(filled)) + fg(INK_SOFT, barChars.empty.repeat(width - filled));
  };

  return {
    caps,
    fg,
    bold: (s) => (caps.color ? wrap("1", s) : s),
    dim: (s) => (caps.color ? wrap("2", s) : s),
    severity: (sev, s) => fg(SEV[sev], s),
    band: (b, s) => fg(BAND[b], s),
    bar,
    box,
  };
}
