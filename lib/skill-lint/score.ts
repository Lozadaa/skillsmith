import type { Finding, ScoreResult } from "./model";

/** Starting weights per spec §6 — calibrate against the fixture corpus by editing this object only. */
export const SCORE_WEIGHTS = { error: 15, warning: 5, suggestion: 1 };

export function computeScore(findings: Finding[]): ScoreResult {
  const penalty = findings.reduce((sum, f) => sum + SCORE_WEIGHTS[f.severity], 0);
  const value = Math.max(0, 100 - penalty);
  const band = value >= 90 ? "excellent" : value >= 70 ? "good" : value >= 40 ? "needs-work" : "poor";
  return { value, band };
}
