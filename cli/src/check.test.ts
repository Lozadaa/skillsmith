import { describe, it, expect } from "vitest";
import type { Finding } from "../../lib/skill-lint";
import type { AnalyzedSkill } from "./analyze";
import { makeTheme } from "./tui/theme";
import { runCheck, type CheckOptions } from "./check";

const theme = makeTheme({ color: false, truecolor: false, unicode: true });
const opts = (o: Partial<CheckOptions> = {}): CheckOptions => ({
  format: "stylish",
  maxWarnings: Infinity,
  quiet: false,
  ...o,
});

const finding = (severity: Finding["severity"], ruleId: string, message: string, line?: number): Finding => ({
  ruleId,
  severity,
  message,
  why: "because",
  howToFix: "do this",
  line,
});

const skill = (dirName: string, findings: Finding[]): AnalyzedSkill => ({
  dirName,
  dir: `/tmp/${dirName}`,
  files: [],
  outcome: {
    kind: "skill",
    // Only findings/score/tokens are read by check.
    skill: {} as never,
    findings,
    score: { value: 50, band: "needs-work" },
    tokens: { metadata: 0, body: 0, references: 0, scriptFiles: 0, total: 0 },
  },
});

describe("runCheck exit codes", () => {
  it("exits 1 when there is an error, 0 when clean", () => {
    const withError = [skill("a", [finding("error", "E01", "missing name", 1)])];
    expect(runCheck(withError, opts(), theme).exitCode).toBe(1);
    expect(runCheck([skill("b", [])], opts(), theme).exitCode).toBe(0);
  });

  it("exits 0 for warnings by default but 1 when they exceed --max-warnings", () => {
    const withWarning = [skill("a", [finding("warning", "W07", "too long", 3)])];
    expect(runCheck(withWarning, opts(), theme).exitCode).toBe(0);
    expect(runCheck(withWarning, opts({ maxWarnings: 0 }), theme).exitCode).toBe(1);
  });
});

describe("runCheck stylish output", () => {
  it("groups by skill and ends with a problem summary", () => {
    const skills = [skill("a", [finding("error", "E01", "missing name", 1), finding("warning", "W07", "too long", 3)])];
    const { text } = runCheck(skills, opts(), theme);
    expect(text).toContain("a/SKILL.md");
    expect(text).toContain("missing name");
    expect(text).toContain("E01");
    expect(text).toMatch(/2 problems \(1 error, 1 warning/);
  });

  it("reports a clean pass when there are no findings", () => {
    expect(runCheck([skill("a", [])], opts(), theme).text).toContain("no problems");
  });
});

describe("runCheck --quiet and --format json", () => {
  it("quiet drops warnings and suggestions from the count", () => {
    const skills = [skill("a", [finding("warning", "W1", "w"), finding("suggestion", "S1", "s")])];
    const { text, exitCode } = runCheck(skills, opts({ quiet: true }), theme);
    expect(exitCode).toBe(0);
    expect(text).toContain("no problems");
  });

  it("json format emits parseable messages", () => {
    const skills = [skill("a", [finding("error", "E01", "missing name", 1)])];
    const { text } = runCheck(skills, opts({ format: "json" }), theme);
    const parsed = JSON.parse(text);
    expect(parsed[0].dirName).toBe("a");
    expect(parsed[0].messages[0]).toMatchObject({ ruleId: "E01", severity: "error", line: 1 });
  });
});
