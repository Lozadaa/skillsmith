import { describe, it, expect } from "vitest";
import { computeScore } from "./score";
import { mk } from "./rules/util";

describe("computeScore", () => {
  it("returns 100 / excellent with no findings", () => {
    expect(computeScore([])).toEqual({ value: 100, band: "excellent" });
  });

  it("weights severities: error 15, warning 5, suggestion 1", () => {
    const findings = [
      mk("E01", "error", "m", "w", "f"),
      mk("W01", "warning", "m", "w", "f"),
      mk("S01", "suggestion", "m", "w", "f"),
    ];
    expect(computeScore(findings).value).toBe(100 - 15 - 5 - 1);
  });

  it("never goes below 0 and assigns bands", () => {
    const errors = Array.from({ length: 10 }, (_, i) => mk(`E${i}`, "error" as const, "m", "w", "f"));
    const r = computeScore(errors);
    expect(r.value).toBe(0);
    expect(r.band).toBe("poor");
    expect(computeScore([mk("W01", "warning", "m", "w", "f")]).band).toBe("excellent"); // 95
    expect(computeScore([mk("E01", "error", "m", "w", "f"), mk("E02", "error", "m", "w", "f")]).band).toBe("good"); // 70
  });
});
