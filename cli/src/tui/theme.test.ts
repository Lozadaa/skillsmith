import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectCaps, makeTheme } from "./theme";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = {
    NO_COLOR: process.env.NO_COLOR,
    FORCE_COLOR: process.env.FORCE_COLOR,
    COLORTERM: process.env.COLORTERM,
    TERM: process.env.TERM,
  };
  delete process.env.NO_COLOR;
  delete process.env.FORCE_COLOR;
  delete process.env.COLORTERM;
  process.env.TERM = "xterm";
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("detectCaps", () => {
  it("colors on a TTY, stays plain on a pipe", () => {
    expect(detectCaps({ isTTY: true }).color).toBe(true);
    expect(detectCaps({ isTTY: false }).color).toBe(false);
    expect(detectCaps({}).color).toBe(false); // isTTY undefined => no color
  });

  it("honors NO_COLOR and --no-color, and FORCE_COLOR", () => {
    process.env.NO_COLOR = "1";
    expect(detectCaps({ isTTY: true }).color).toBe(false);
    delete process.env.NO_COLOR;
    expect(detectCaps({ isTTY: true, noColor: true }).color).toBe(false);
    process.env.FORCE_COLOR = "1";
    expect(detectCaps({ isTTY: false }).color).toBe(true);
  });

  it("detects truecolor from COLORTERM", () => {
    process.env.COLORTERM = "truecolor";
    expect(detectCaps({ isTTY: true }).truecolor).toBe(true);
  });
});

describe("makeTheme", () => {
  it("returns raw text when color is off", () => {
    const t = makeTheme({ color: false, truecolor: false, unicode: true });
    expect(t.fg("#FF8A4A", "hi")).toBe("hi");
  });

  it("emits a 24-bit sequence in truecolor", () => {
    const t = makeTheme({ color: true, truecolor: true, unicode: true });
    expect(t.fg("#FF8A4A", "hi")).toContain("38;2;255;138;74");
  });

  it("draws a bar of exactly `width` visible cells", () => {
    const t = makeTheme({ color: true, truecolor: true, unicode: true });
    expect(strip(t.bar(50, 10))).toHaveLength(10);
    expect(strip(t.bar(0, 8))).toHaveLength(8);
  });
});
